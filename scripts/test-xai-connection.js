import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

// Simple .env parser
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        acc[key.trim()] = value.trim().replace(/^"|"$/g, '');
    }
    return acc;
}, {});

const apiKey = envConfig.XAI_API_KEY;

if (!apiKey) {
    console.error("❌ XAI_API_KEY not found in .env");
    process.exit(1);
}

const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.x.ai/v1",
});

async function analyzeImage(modelName) {
    console.log(`📡 Testing connection to xAI with model: ${modelName}...`);
    try {
        const response = await client.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is 2+2?" },
                    ],
                },
            ],
            stream: false,
        });

        console.log(`✅ Connection Successful with ${modelName}!`);
        return true;
    } catch (error) {
        if (error.response) {
            console.error(`❌ Connection Failed with ${modelName}: HTTP ${error.response.status}`);
            // Only print details if it's not a generic 404/400 model missing error
            if (error.response.status !== 400 && error.response.status !== 404) {
                console.error(JSON.stringify(error.response.data, null, 2));
            }
        } else {
            console.error(`❌ Connection Failed with ${modelName}:`, error.message);
        }
        return false;
    }
}

async function listModels() {
    console.log("\n📋 Attempting to list available models...");
    try {
        const list = await client.models.list();
        console.log("✅ Available Models:");
        list.data.forEach(m => console.log(` - ${m.id}`));
    } catch (error) {
        console.error("❌ Failed to list models:");
        if (error.response) {
            console.error(`HTTP ${error.response.status}`);
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

(async () => {
    // 1. Try to list models (Best way to see permissions & what's available)
    await listModels();

    // 2. Try known models if list fails or just to be sure
    console.log("\n🔄 Trying direct connection to specific models:");
    await analyzeImage("grok-2-latest");
    await analyzeImage("grok-vision-beta");
})();
