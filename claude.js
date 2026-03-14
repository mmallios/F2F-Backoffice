require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function askClaude() {
    const response = await client.messages.create({
        model: "claude-3.5-sonnet-20260301",
        max_tokens: 100,
        messages: [{ role: "user", content: "Γράψε ένα αστείο!" }]
    });
    console.log(response.content);
}

askClaude();
