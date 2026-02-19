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

const apiKey = envConfig.GEMINI_API_KEY || envConfig.AI_API_KEY;

if (!apiKey || apiKey.includes("your-google-gemini-key-here")) {
    console.error("❌ GEMINI_API_KEY not found or invalid in .env");
    process.exit(1);
}

const client = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

async function testGemini() {
    const modelName = "gemini-1.5-flash";
    console.log(`📡 Testing connection to Google Gemini (${modelName})...`);
    try {
        const response = await client.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "user",
                    content: "Hello! confirm you are active.",
                },
            ],
            stream: false,
        });

        console.log(`✅ Connection Successful!`);
        console.log("--------------- Response ---------------");
        console.log(response.choices[0].message.content);
        console.log("----------------------------------------");
        return true;
    } catch (error) {
        if (error.response) {
            console.error(`❌ Connection Failed: HTTP ${error.response.status}`);
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`❌ Connection Failed:`, error.message);
        }
        return false;
    }
}

testGemini();
