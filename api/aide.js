// api/aide.js
// vercel serverless function - proxies requests to gemini api
// the api key lives in vercel environment variables and never reaches the client
// this is the standard pattern for securing llm api keys in client-side apps

export default async function handler(req, res) {
    // only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'api key not configured' });
    }

    const { levelTitle, levelDescription, category, blocksUsed, optimal, code } = req.body;

    // validate required fields
    if (!levelTitle || !code) {
        return res.status(400).json({ error: 'missing required fields' });
    }

    // build the pedagogical prompt - this is the core of the AIDE
    // the prompt is strict: no direct answers, conceptual hints only,
    // child-appropriate language, warm and encouraging tone
    // this directly implements the Intelligent Tutoring System pattern
    // described in the project architecture doc (inspired by Duolingo)
    const prompt = `You are a warm, encouraging teacher helping a child aged 7-11 learn programming using a block-based robot game.

The student is programming a robot on a grid to reach a green target.

Level: ${levelTitle}
Objective: ${levelDescription}
Category: ${category}
Blocks the student used: ${blocksUsed}
Optimal number of blocks: ${optimal}
What their code does: ${code}

The robot did not reach the target. Write a hint of 2-3 short sentences that:
- Does NOT reveal the answer or give exact instructions
- Explains conceptually what might have gone wrong or what to think about
- Uses simple language a child can understand (no jargon)
- Is warm, encouraging and not discouraging
- Starts with a short encouraging phrase

Do not use bullet points. Do not write code. Keep it short and friendly.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 120,
                    }
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('gemini api error:', err);
            return res.status(502).json({ error: 'gemini request failed' });
        }

        const data = await response.json();
        const hint = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

        if (!hint) {
            return res.status(502).json({ error: 'no hint returned' });
        }

        return res.status(200).json({ hint });

    } catch (err) {
        console.error('aide handler error:', err);
        return res.status(500).json({ error: 'internal server error' });
    }
}