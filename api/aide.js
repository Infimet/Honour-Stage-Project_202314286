// api/aide.js
// vercel serverless function - proxies requests to anthropic api
// the api key lives in vercel environment variables and never reaches the client

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'method not allowed' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'api key not configured' });
    }

    const { levelTitle, levelDescription, category, blocksUsed, optimal, code } = req.body;

    if (!levelTitle || !code) {
        return res.status(400).json({ error: 'missing required fields' });
    }

    // build category-specific context for the prompt
    // this makes hints relevant to what the student should be thinking about
    const categoryContext = {
        basics: `This is a movement basics level. The student should be thinking about:
- Which direction the robot is facing (it starts facing UP/north)
- How many steps forward are needed to reach the target
- Whether any turns are needed and in which direction
- If they used more blocks than optimal, gently encourage them to think about whether a loop could make it more efficient`,

        loops: `This is a loops level. The student should be thinking about:
- Using the Repeat block to avoid repeating the same blocks over and over
- How many times an action needs to repeat
- Combining movement blocks inside a repeat block
- Whether their solution could be made shorter and more efficient with loops`,

        obstacles: `This is an obstacles level. There are walls on the grid blocking certain paths.
The student should be thinking about:
- Looking at where the walls are on the grid before coding
- Planning a route around the obstacles rather than straight to the target
- Using turns to navigate around walls
- Breaking the journey into segments: move to clear space, turn, move again`,

        conditionals: `This is a conditionals level. The student should be thinking about:
- Using the sensor blocks (If Path is Clear, While Path is Clear) to detect walls
- The robot can "see" one step ahead - use this to make decisions
- Combining movement with sensor checks
- The While Path is Clear block repeats as long as the path ahead is open`
    };

    const catGuidance = categoryContext[category] || categoryContext.basics;

    const prompt = `You are a warm, encouraging teacher helping a child aged 7-11 learn programming using a block-based robot game.

The student is programming a robot on a grid to reach a green target.

Level: ${levelTitle}
Objective: ${levelDescription}
Category: ${category}
Blocks the student used: ${blocksUsed}
Optimal number of blocks: ${optimal}
What their code does: ${code}

CATEGORY CONTEXT — use this to make your hint relevant:
${catGuidance}

The robot did not reach the target. Write a hint of 2-3 short sentences that:
- Does NOT reveal the answer or give exact instructions
- Explains conceptually what might have gone wrong based on the category context above
- Uses simple language a child can understand (no jargon)
- Is warm, encouraging and not discouraging
- Starts with a short encouraging phrase like "Great try!" or "You're on the right track!"
- If blocks used is significantly more than optimal, gently hint that there might be a more efficient way

Do not use bullet points. Do not write code. Keep it short and friendly.`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 150,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('anthropic api error:', response.status, err.substring(0, 300));
            return res.status(502).json({ error: 'anthropic request failed' });
        }

        const data = await response.json();
        const hint = data.content?.[0]?.text ?? null;

        if (!hint) {
            return res.status(502).json({ error: 'no hint returned' });
        }

        return res.status(200).json({ hint });

    } catch (err) {
        console.error('aide handler error:', err.message);
        return res.status(500).json({ error: 'internal server error' });
    }
}