import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import * as xlsx from "xlsx";
import { Groq } from "groq-sdk";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { pipeline } from "@xenova/transformers";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory "Vector Store"
let documents: { content: string; metadata: any; embedding: number[] }[] = [];
let model: any = null;

// Initialize Embedding Model
async function initModel() {
  if (!model) {
    console.log("Loading embedding model...");
    model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Model loaded.");
  }
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

function cosineSimilarity(vecA: number[], vecB: number[]) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}

// API Routes
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("No file uploaded");
    console.log("File received, starting model init...");
    await initModel();

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) throw new Error("The Excel file seems to be empty or unreadable.");

    console.log(`Processing ${data.length} rows...`);

    const newDocuments = [];
    const BATCH_SIZE = 10; // Increased batch size
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const chunk = data.slice(i, i + BATCH_SIZE);
      const promises = chunk.map(async (record) => {
        const content = Object.entries(record as any)
          .map(([key, val]) => `${key}: ${val}`)
          .join(", ");
        
        try {
          const output = await model(content, { pooling: "mean", normalize: true });
          return {
            content,
            metadata: record,
            embedding: Array.from(output.data) as number[]
          };
        } catch (e) {
          console.error("Error embedding row:", e);
          return null;
        }
      });
      
      const results = (await Promise.all(promises)).filter(d => d !== null);
      newDocuments.push(...results);
      console.log(`Indexed ${Math.min(i + BATCH_SIZE, data.length)} / ${data.length} rows`);
    }

    documents = newDocuments as any;
    console.log("Indexing complete. Ready for queries.");
    res.json({ message: "File processed and indexed", count: documents.length });
  } catch (error: any) {
    console.error("Upload error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) throw new Error("Question is required");
    if (documents.length === 0) throw new Error("Please upload a file first");

    await initModel();

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY is not configured");

    const groq = new Groq({ apiKey: groqKey });

    // 1. Embed the question
    const output = await model(question, { pooling: "mean", normalize: true });
    const questionEmbedding = Array.from(output.data) as number[];

    // 2. Retrieve top-k documents (Simple FAISS alternative in Node)
    const scoredDocs = documents.map(doc => ({
      ...doc,
      score: cosineSimilarity(questionEmbedding, doc.embedding)
    }));

    scoredDocs.sort((a, b) => b.score - a.score);
    const context = scoredDocs.slice(0, 5).map(d => d.content).join("\n\n---\n\n");

    // 3. Generate response with Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions based on the provided Excel data context. Use only the provided context to answer. If the answer isn't in the context, say you don't know."
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`
        }
      ],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/status", (req, res) => {
  res.json({ indexed: documents.length > 0, count: documents.length });
});

// Vite middleware for development
async function startServer() {
  console.log("Starting server and pre-loading model...");
  try {
    await initModel();
    console.log("Pre-loading finished.");
  } catch (e) {
    console.error("Failed to pre-load model:", e);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
