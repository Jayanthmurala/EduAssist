import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found in .env");
    process.exit(1);
}

console.log(`🔑 Using API Key: ${apiKey.slice(0, 10)}...`);

async function testNativeGemini() {
    // Correct URL format from documentation
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    console.log(`📡 Sending request to Native Gemini Endpoint...`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello, confirm you are active." }]
                }]
            })
        });

        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Response Body:", text);
        } else {
            const data = await response.json();
            console.log("✅ Success!");
            // console.log(JSON.stringify(data, null, 2));
            console.log("Response:", data.candidates[0].content.parts[0].text);
        }
    } catch (err) {
        console.error("❌ Network Error:", err.message);
    }
}

testNativeGemini();
