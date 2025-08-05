import express from 'express';
import { Buffer } from 'buffer';

const router = express.Router();

router.post('/generate', async (req, res) => {
    try {
        const {
            apiName,
            apiDescription,
            basepath,
            endpoints = []
        } = req.body;

        if (!apiName || !apiDescription || !basepath || !Array.isArray(endpoints)) {
            return res.status(400).json({
                error: 'Missing required fields: apiName, apiDescription, basepath, or endpoints'
            });
        }

        let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${apiName} - API Documentation</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 2em; background: #f9f9f9; color: #333; }
                h1, h2, h3 { color: #444; }
                pre { background: #eee; padding: 1em; overflow-x: auto; }
                .endpoint { margin-bottom: 2em; }
                .param-table { border-collapse: collapse; width: 100%; margin-top: 1em; }
                .param-table th, .param-table td { border: 1px solid #ccc; padding: 0.5em; }
                .param-table th { background: #f0f0f0; }
                code { background: #e3e3e3; padding: 2px 4px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>${apiName}</h1>
            <p>${apiDescription}</p>
            <p><strong>Base Path:</strong> <code>${basepath}</code></p>
        `;

        for (const ep of endpoints) {
            let decodedSampleRequest = null;
            let decodedSampleResponse = null;
            let decodedCurl = '';

            try {
                if (ep.sampleRequest) {
                    const decoded = Buffer.from(ep.sampleRequest, 'base64').toString('utf-8');
                    try {
                        decodedSampleRequest = JSON.parse(decoded);
                    } catch {
                        decodedSampleRequest = decoded;
                    }
                }

                if (ep.sampleResponse) {
                    const decoded = Buffer.from(ep.sampleResponse, 'base64').toString('utf-8');
                    try {
                        decodedSampleResponse = JSON.parse(decoded);
                    } catch {
                        decodedSampleResponse = decoded;
                    }
                }

                if (ep.cURL) {
                    decodedCurl = Buffer.from(ep.cURL, 'base64').toString('utf-8');
                }
            } catch (e) {
                console.warn(`Error decoding base64 content for path: ${ep.path}`, e);
            }

            html += `
                <div class="endpoint">
                    <h2>Endpoint: <code>${ep.path}</code></h2>
                    <p>${ep.endpointDescription}</p>
            `;

            // Query Parameters
            if (Array.isArray(ep.queryParams) && ep.queryParams.length > 0) {
                html += `
                    <h3>Query Parameters</h3>
                    <table class="param-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Sample Value</th>
                                <th>Required</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                for (const qp of ep.queryParams) {
                    html += `
                        <tr>
                            <td>${qp.name}</td>
                            <td>${qp.description}</td>
                            <td><code>${qp.sampleValue}</code></td>
                            <td>${qp.required ? 'Yes' : 'No'}</td>
                        </tr>
                    `;
                }
                html += `
                        </tbody>
                    </table>
                `;
            }

            // Request Body
            if (Array.isArray(ep.requestBody) && ep.requestBody.length > 0) {
                html += `
                    <h3>Request Body</h3>
                    <table class="param-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Sample Value</th>
                                <th>Required</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                for (const rb of ep.requestBody) {
                    html += `
                        <tr>
                            <td>${rb.name}</td>
                            <td>${rb.type}</td>
                            <td>${rb.description}</td>
                            <td><code>${rb.sampleValue}</code></td>
                            <td>${rb.required ? 'Yes' : 'No'}</td>
                        </tr>
                    `;
                }
                html += `
                        </tbody>
                    </table>
                `;
            }

            // Sample Request
            if (decodedSampleRequest) {
                html += `
                    <h3>Sample Request</h3>
                    <pre>${typeof decodedSampleRequest === 'string'
                        ? decodedSampleRequest
                        : JSON.stringify(decodedSampleRequest, null, 2)}</pre>
                `;
            }

            // Sample Response
            if (decodedSampleResponse) {
                html += `
                    <h3>Sample Response</h3>
                    <pre>${typeof decodedSampleResponse === 'string'
                        ? decodedSampleResponse
                        : JSON.stringify(decodedSampleResponse, null, 2)}</pre>
                `;
            }

            // cURL
            if (decodedCurl) {
                html += `
                    <h3>cURL Command</h3>
                    <pre>${decodedCurl}</pre>
                `;
            }

            html += `</div>`;
        }

        html += `
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${apiName.replace(/\s+/g, '_').toLowerCase()}_docs.html"`
        );

        return res.status(200).send(html);
    } catch (err) {
        console.error('Error generating documentation:', err);
        return res.status(500).json({ error: 'Failed to generate documentation.' });
    }
});

router.post('/curl/base64', express.text({ type: '*/*' }), (req, res) => {
    try {
        const curlRaw = req.body;

        if (!curlRaw || typeof curlRaw !== 'string') {
            return res.status(400).json({ error: 'Missing raw cURL input.' });
        }

        const base64Encoded = Buffer.from(curlRaw, 'utf-8').toString('base64');
        return res.json({ base64: base64Encoded });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to encode.', details: err.message });
    }
});

router.post('/json/base64', (req, res) => {
    try {
        const { json } = req.body;

        if (!json || typeof json !== 'object' || Array.isArray(json)) {
            return res.status(400).json({ error: 'Invalid or missing "json" in request body.' });
        }

        const jsonString = JSON.stringify(json);
        const base64Encoded = Buffer.from(jsonString, 'utf-8').toString('base64');

        return res.json({ base64: base64Encoded });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to encode JSON to base64.', details: err.message });
    }
});

router.post('/text/base64', (req, res) => {
  const { input } = req.body;

  if (typeof input !== 'string') {
    return res.status(400).json({ error: 'input must be a string' });
  }

  try {
    const encoded = Buffer.from(input, 'utf-8').toString('base64');
    return res.status(200).json({ base64: encoded });
  } catch (err) {
    console.error('Encoding error:', err);
    return res.status(500).json({ error: 'Failed to encode string' });
  }
});

export default router;
