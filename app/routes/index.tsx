import { HtmlRewriterReadability, type ReadabilityOptions } from '@akira108sys/html-rewriter-readability';
import { createRoute } from 'honox/factory';
import { z } from 'zod';

const baseOptionsSchema = z.object({
    maxElemsToParse: z.coerce.number().min(0).max(10000).optional(),
    nbTopCandidates: z.coerce.number().min(1).max(20).optional(),
    charThreshold: z.coerce.number().min(0).max(10000).optional(),
    linkDensityModifier: z.coerce.number().min(0).max(1).optional(),
    classesToPreserve: z.string().max(200).transform(val =>
        val.split(',').map(s => s.trim()).filter(Boolean)
    ).optional(),
    keepClasses: z.preprocess(
        val => val === 'true' || val === 'on',
        z.boolean()
    ).optional(),
});

const readabilityOptionsSchema = baseOptionsSchema.transform(data => {
    const result: Partial<ReadabilityOptions> = {};
    if (data.maxElemsToParse !== undefined) result.maxElemsToParse = data.maxElemsToParse;
    if (data.nbTopCandidates !== undefined) result.nbTopCandidates = data.nbTopCandidates;
    if (data.charThreshold !== undefined) result.charThreshold = data.charThreshold;
    if (data.linkDensityModifier !== undefined) result.linkDensityModifier = data.linkDensityModifier;
    if (data.classesToPreserve !== undefined) result.classesToPreserve = data.classesToPreserve;
    if (data.keepClasses !== undefined) result.keepClasses = data.keepClasses;
    return result;
});

const requestSchema = z.object({
    url: z.string().url('Invalid URL format'),
    ...baseOptionsSchema.shape
});

export default createRoute((c) => {
    const url = c.req.query('url');
    if (!url) {
        return c.render(<Home />);
    }
    const options = parseOptions(c.req.query());
    return processUrl(url, options);
});

export const POST = createRoute(async (c) => {
    const contentType = c.req.header('content-type');
    let dataToValidate: unknown;

    if (contentType?.includes('application/json')) {
        dataToValidate = await c.req.json();
    } else if (contentType?.includes('application/x-www-form-urlencoded') || contentType?.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const data: Record<string, string | File> = {};
        formData.forEach((value, key) => {
            // Keep only the first value if multiple are present for the same key
            if (!(key in data)) {
                data[key] = value;
            }
        });

        // Convert File objects to string placeholders if necessary, or handle them appropriately
        // For this schema, we expect strings, so let's ensure values are strings
        const stringData: Record<string, string> = {};
        for (const key in data) {
            if (typeof data[key] === 'string') {
                stringData[key] = data[key] as string;
            }
        }
        dataToValidate = stringData;
    } else {
        return c.text('Unsupported Content-Type. Please use application/json, application/x-www-form-urlencoded, or multipart/form-data.', 415);
    }

    const result = requestSchema.safeParse(dataToValidate);

    if (!result.success) {
        // Return validation errors, perhaps render the form again with errors
        // For simplicity, returning JSON error for now
        return c.json({
            error: 'Validation failed',
            issues: result.error.issues
        }, 400);
    }

    const { url, ...options } = result.data;
    return processUrl(url, options);
});

const Home = () => {
    return (
        <div class="min-h-screen flex flex-col items-center justify-center p-4">
            <div class="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-4">
                    HTML Rewriter Readability Demo
                </h1>
                <p class="text-gray-600 mb-4">
                    Enter a URL to convert the webpage into readable markdown format.
                </p>
                <div class="flex gap-4 mb-8">
                    <a href="https://github.com/akira108/html-rewriter-readability" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 transition-colors">
                        Library GitHub
                    </a>
                    <a href="https://github.com/akira108/html-rewriter-readability-demo" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 transition-colors">
                        Demo GitHub
                    </a>
                    <a href="https://www.npmjs.com/package/@akira108sys/html-rewriter-readability" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 transition-colors">
                        npm
                    </a>
                </div>
                <form id="form" class="space-y-6" method="post" action="/">
                    <div class="flex gap-4">
                        <input
                            type="url"
                            id="url"
                            name="url"
                            placeholder="Enter a URL"
                            required
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                        />
                        <button
                            type="submit"
                            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                            Convert
                        </button>
                    </div>

                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold text-gray-900">Advanced Options</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="maxElemsToParse" class="block text-sm font-medium text-gray-700 mb-1">Max Elements to Parse</label>
                                <input
                                    type="number"
                                    id="maxElemsToParse"
                                    name="maxElemsToParse"
                                    placeholder="0-10000 (0 = infinite)"
                                    value={0}
                                    min="0"
                                    max="10000"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                />
                                <p class="text-xs text-gray-500 mt-1">The maximum number of elements to parse (0 = no limit).</p>
                            </div>
                            <div>
                                <label htmlFor="nbTopCandidates" class="block text-sm font-medium text-gray-700 mb-1">Top Candidates</label>
                                <input
                                    type="number"
                                    id="nbTopCandidates"
                                    name="nbTopCandidates"
                                    placeholder="1-20 (Default: 5)"
                                    value={5}
                                    min="1"
                                    max="20"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                />
                                <p class="text-xs text-gray-500 mt-1">The number of top candidates to consider (Default: 5).</p>
                            </div>
                            <div>
                                <label htmlFor="charThreshold" class="block text-sm font-medium text-gray-700 mb-1">Character Threshold</label>
                                <input
                                    type="number"
                                    id="charThreshold"
                                    name="charThreshold"
                                    placeholder="0-10000 (Default: 500)"
                                    value={500}
                                    min="0"
                                    max="10000"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                />
                                <p class="text-xs text-gray-500 mt-1">The minimum characters an article must have (Default: 500).</p>
                            </div>
                            <div>
                                <label htmlFor="linkDensityModifier" class="block text-sm font-medium text-gray-700 mb-1">Link Density Modifier</label>
                                <input
                                    type="number"
                                    id="linkDensityModifier"
                                    name="linkDensityModifier"
                                    placeholder="0-1 (Default: 0)"
                                    value={0}
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                />
                                <p class="text-xs text-gray-500 mt-1">Adjusts link density threshold for shadiness checks (Default: 0).</p>
                            </div>
                            <div>
                                <label htmlFor="classesToPreserve" class="block text-sm font-medium text-gray-700 mb-1">Classes to Preserve</label>
                                <input
                                    type="text"
                                    id="classesToPreserve"
                                    name="classesToPreserve"
                                    placeholder="e.g. image,figure"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                />
                                <p class="text-xs text-gray-500 mt-1">Comma-separated list of classes to preserve when Keep Classes is off.</p>
                            </div>
                            <div class="flex items-center">
                                <input
                                    type="checkbox"
                                    id="keepClasses"
                                    name="keepClasses"
                                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="keepClasses" class="ml-2 block text-sm text-gray-700">Keep Classes</label>
                                <p class="text-xs text-gray-500 mt-1 ml-6">Preserve all classes on HTML elements (Default: false).</p>
                            </div>
                        </div>
                    </div>
                </form>
                <div class="mt-8 p-4 bg-gray-50 rounded-md">
                    <h2 class="text-lg font-semibold text-gray-900 mb-2">API Examples</h2>
                    <p class="text-sm text-gray-600 mb-2">Note: All parameters except <code>url</code> are optional. It can be used for GET request too.</p>
                    <h3 class="text-md font-medium text-gray-800 mt-4 mb-1">GET Request</h3>
                    <pre class="bg-gray-100 p-3 rounded-md overflow-x-auto text-sm font-mono text-gray-800">curl "https://html-rewriter-readability.akira108.workers.dev/?url={'{'}url{'}'}&keepClasses=true"</pre>
                    <h3 class="text-md font-medium text-gray-800 mt-4 mb-1">POST Request</h3>
                    <pre class="bg-gray-100 p-3 rounded-md overflow-x-auto text-sm font-mono text-gray-800">
                        {`curl -X POST -H "Content-Type: application/json" \\
                        -d '{"url": "{url}", "keepClasses": true}' \\
                        "https://readability.akira108.workers.dev/"`}
                    </pre>
                </div>
            </div>
        </div>
    )
}


function parseOptions(params: Record<string, string | string[]>): Partial<ReadabilityOptions> {
    const result = readabilityOptionsSchema.safeParse(params);
    return result.success ? result.data : {};
}

async function processUrl(targetUrl: string, options: Partial<ReadabilityOptions> = {}): Promise<Response> {
    try {
        new URL(targetUrl); // Validate URL
    } catch (e) {
        return new Response(`Invalid URL: ${targetUrl}`, { status: 400 });
    }

    try {
        console.log(`Fetching origin: ${targetUrl}`);
        const originResponse = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HTMLRewriterReadabilityDemo/0.1.0)' }
        });

        if (!originResponse.ok) {
            throw new Error(`Failed to fetch origin: ${originResponse.status} ${originResponse.statusText}`);
        }
        const originContentType = originResponse.headers.get('content-type');
        if (!originContentType || !originContentType.toLowerCase().includes('text/html')) {
            throw new Error(`Origin response is not HTML (Content-Type: ${originContentType})`);
        }

        const baseURI = new URL(targetUrl);
        const processor = new HtmlRewriterReadability(baseURI, { debug: true, ...options });
        const result = await processor.process(originResponse);
        console.log(`Result: ${JSON.stringify(result)}`);
        if (result && result.markdown !== null) {
            const headers = new Headers({
                'content-type': 'text/markdown; charset=utf-8',
                'X-Processed-Url': targetUrl,
            });

            if (result.metadata.title) headers.set('X-Article-Title', result.metadata.title);
            if (result.metadata.byline) headers.set('X-Article-Byline', result.metadata.byline);
            if (result.metadata.siteName) headers.set('X-Site-Name', result.metadata.siteName);
            if (result.metadata.excerpt) headers.set('X-Article-Excerpt', result.metadata.excerpt);

            return new Response(result.markdown, { headers });
        }
        throw new Error('Failed to extract content. Please try adjusting the charThreshold or nbTopCandidates options.');
    } catch (e) {
        console.error('Error processing URL:', e);
        const error = e as Error;
        return new Response(`Error processing URL: ${error.message}`, { status: 500 });
    }
}
