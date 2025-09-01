/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import Chart from 'chart.js';
import { Chart as ChartJS, registerables } from 'chart.js';

// Register all chart.js components
ChartJS.register(...registerables);

// --- Type Definitions ---
type AIProvider = 'Google AI' | 'OpenAI' | 'Mistral' | 'OpenRouter';

// --- DOM Elements ---
const form = document.getElementById('keyword-form') as HTMLFormElement;
const input = document.getElementById('keyword-input') as HTMLInputElement;
const countryInput = document.getElementById('country-input') as HTMLInputElement;
const languageInput = document.getElementById('language-input') as HTMLInputElement;
const button = document.getElementById('analyze-button') as HTMLButtonElement;
const resultsContainer = document.getElementById('results-container') as HTMLElement;
const logoContainer = document.getElementById('logo-container') as HTMLElement;

// Settings Panel Elements
const settingsToggle = document.getElementById('settings-toggle') as HTMLButtonElement;
const settingsPanel = document.getElementById('settings-panel') as HTMLElement;
const apiKeyForm = document.getElementById('api-key-form') as HTMLFormElement;
const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const setupMessage = document.getElementById('setup-message') as HTMLElement;


let ai: GoogleGenAI | null = null;
let currentProvider: AIProvider | null = null;
let currentApiKey: string | null = null;
let searchVolumeChart: Chart | null = null;
let competitionChart: Chart | null = null;


/**
 * Initializes the application, sets up the AI client, and enables the UI.
 * @param provider The selected AI provider.
 * @param apiKey The user-provided API key.
 */
function setupApplication(provider: AIProvider, apiKey: string) {
    try {
        currentProvider = provider;
        currentApiKey = apiKey;

        if (provider === 'Google AI') {
            // FIX: Per coding guidelines, the API key must be sourced from process.env.API_KEY.
            ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            // Generate logo only for Google AI
            generateAndSetLogo();
        } else {
            ai = null;
            logoContainer.innerHTML = ''; // Clear logo if not Google
        }

        // Hide settings and setup messages
        settingsPanel.classList.add('hidden');
        setupMessage.classList.add('hidden');

        // Enable the main form
        form.classList.remove('disabled');
        input.disabled = false;
        countryInput.disabled = false;
        languageInput.disabled = false;
        button.disabled = false;

    } catch (error) { // FIX: Corrected catch block syntax.
        console.error("Failed to initialize:", error);
        renderError("فشل تهيئة العميل. يرجى التحقق من مفتاح API الخاص بك.");
        // Keep UI disabled if initialization fails
        showSetup();
    }
}


/**
 * Generates and displays a unique logo for the application (Google AI only).
 */
async function generateAndSetLogo() {
    if (!ai) return;

    logoContainer.innerHTML = '<div class="logo-loader"></div>';
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: 'A minimalist, flat vector logo for an SEO keyword analysis tool. It should creatively combine a magnifying glass and a simple brain icon, symbolizing search and intelligence. Use shades of blue (#4285F4) and grey (#5f6368). The logo should be on a clean white background and centered.',
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
        logoContainer.innerHTML = `<img src="${imageUrl}" alt="شعار أداة تحليل الكلمات المفتاحية" />`;
    } catch (error) {
        console.error('Error generating logo:', error);
        logoContainer.style.display = 'none';
    }
}

/**
 * Creates the prompt for the AI model.
 * @param keyword The keyword to analyze.
 * @param country The target country for analysis.
 * @param language The target language for analysis.
 * @param useGoogleSearch Whether to instruct the model to use Google Search.
 */
function createPrompt(keyword: string, country: string, language: string, useGoogleSearch: boolean): string {
  const searchInstruction = useGoogleSearch ? "using Google Search" : "based on your extensive knowledge";
  const locationInstruction = country && language ? ` for the target country "${country}" and language "${language}"` : (country ? ` for the target country "${country}"` : (language ? ` for the target language "${language}"` : ""));

  return `
      You are an expert SEO analyst. Analyze the keyword "${keyword}"${locationInstruction} ${searchInstruction}.
      Provide a complete and detailed study.
      You MUST ONLY return a valid JSON object. Do not include markdown formatting like \`\`\`json.
      The JSON object must have these exact keys:
      - "searchVolume": A string describing the estimated monthly search volume (e.g., "High (10k-100k)", "Medium (1k-10k)", "Low (100-1k)").
      - "searchVolumeValue": An integer representing the estimated average monthly search volume (e.g., for "10k-100k" you could return 55000).
      - "competition": A string describing the SEO competition difficulty (e.g., "High", "Medium", "Low").
      - "competitionScore": An integer from 0 (very easy) to 100 (very hard) representing SEO competition difficulty.
      - "alternatives": An array of 3-5 strong alternative keywords.
      - "suggestedTitles": An array of 3-5 compelling, SEO-friendly article titles.
      - "longTailKeywords": An array of 3-5 related long-tail keywords that are easier to rank for.
    `;
}

/**
 * A centralized function to perform AI analysis based on the selected provider.
 * @param keyword The keyword to analyze.
 * @param country The target country for analysis.
 * @param language The target language for analysis.
 * @param provider The selected AI provider.
 * @param apiKey The API key for the provider.
 */
async function performAnalysis(keyword: string, country: string, language: string, provider: AIProvider, apiKey: string) {
    const prompt = createPrompt(keyword, country, language, provider === 'Google AI');

    if (provider === 'Google AI') {
        if (!ai) throw new Error("Google AI client not initialized.");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        return { responseText: response.text, sources };
    }

    // --- Logic for other providers ---
    let endpoint = '';
    let model = '';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    
    switch(provider) {
        case 'OpenAI':
            endpoint = 'https://api.openai.com/v1/chat/completions';
            model = 'gpt-4o';
            break;
        case 'Mistral':
            endpoint = 'https://api.mistral.ai/v1/chat/completions';
            model = 'mistral-large-latest';
            break;
        case 'OpenRouter':
            endpoint = 'https://openrouter.ai/api/v1/chat/completions';
            model = 'google/gemini-flash-1.5'; // A capable model on OpenRouter
            headers['HTTP-Referer'] = 'https://keyword-analyzer.com'; // Example referrer
            headers['X-Title'] = 'Keyword Analyzer'; // Example title
            break;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" } // Request JSON output where supported
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed for ${provider}: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;
    return { responseText, sources: null }; // No sources for non-Google providers
}


/**
 * Handles the main keyword analysis form submission.
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentProvider || !currentApiKey) {
        renderError("يرجى إعداد مزود الخدمة ومفتاح API الخاص بك أولاً.");
        return;
    }

    const keyword = input.value.trim();
    const country = countryInput.value.trim();
    const language = languageInput.value.trim();
    if (!keyword) return;

    setLoading(true);
    resultsContainer.innerHTML = '<div class="loader"></div>';

    try {
        const { responseText, sources } = await performAnalysis(keyword, country, language, currentProvider, currentApiKey);

        // Clean the response to ensure it's valid JSON
        const jsonString = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonString);
        renderResults(data, sources);

    } catch (error) {
        console.error(error);
        renderError('حدث خطأ أثناء تحليل الكلمة المفتاحية. يرجى التأكد من أن الإدخال صحيح والمحاولة مرة أخرى.');
    } finally {
        setLoading(false);
    }
});

// --- UI Helper Functions ---

function setLoading(isLoading: boolean) {
    input.disabled = isLoading;
    countryInput.disabled = isLoading;
    languageInput.disabled = isLoading;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'جاري التحليل...' : 'تحليل';
}

function renderSearchVolumeChart(value: number) {
    const ctx = document.getElementById('search-volume-chart') as HTMLCanvasElement;
    if (!ctx) return;
    searchVolumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['متوسط البحث الشهري'],
            datasets: [{
                data: [value],
                backgroundColor: ['#4285F4'],
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: value.toLocaleString('ar-EG'),
                    font: { size: 16, family: "'Cairo', sans-serif" },
                    color: '#3c4043',
                    padding: { bottom: 10 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e9ecef' },
                    ticks: { font: { family: "'Cairo', sans-serif" } }
                },
                x: {
                   grid: { display: false },
                   ticks: { font: { family: "'Cairo', sans-serif", size: 14 } }
                }
            }
        }
    });
}

function renderCompetitionChart(score: number) {
    const ctx = document.getElementById('competition-chart') as HTMLCanvasElement;
    if (!ctx) return;

    let color;
    if (score <= 33) {
        color = '#34A853'; // Green
    } else if (score <= 66) {
        color = '#FBBC05'; // Yellow
    } else {
        color = '#EA4335'; // Red
    }
    const backgroundColor = [color, '#e9ecef'];

    const scoreTextPlugin = {
        id: 'scoreText',
        afterDraw(chart: Chart) {
            const { ctx, chartArea: { top, width, height } } = chart;
            const text = score.toString();
            ctx.save();
            ctx.font = `bold ${height / 3.5}px Cairo`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = color;
            ctx.fillText(text, width / 2, top + height);
            ctx.restore();
        }
    };

    competitionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: backgroundColor,
                borderColor: ['#fff', '#fff'],
                borderWidth: 4,
                circumference: 180,
                rotation: 270,
            }]
        },
        plugins: [scoreTextPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            // FIX: Moved the 'cutout' property to the dataset to resolve a TypeScript error.
            cutout: '70%'
        }
    });
}

function renderResults(data: any, sources: any) {
    if (searchVolumeChart) {
        searchVolumeChart.destroy();
        searchVolumeChart = null;
    }
    if (competitionChart) {
        competitionChart.destroy();
        competitionChart = null;
    }
    resultsContainer.innerHTML = ''; // Clear loader or previous results

    const { searchVolume, searchVolumeValue, competition, competitionScore, alternatives, suggestedTitles, longTailKeywords } = data;

    const resultsHtml = `
        ${(searchVolumeValue !== undefined || searchVolume) ? `
        <div class="result-card">
          <h2>📊 حجم البحث</h2>
          <p>${searchVolume || 'غير متوفر'}</p>
          ${searchVolumeValue !== undefined ? '<div class="chart-container"><canvas id="search-volume-chart"></canvas></div>' : ''}
        </div>` : ''}

        ${(competitionScore !== undefined || competition) ? `
        <div class="result-card">
          <h2>⚔️ صعوبة المنافسة</h2>
          <p>${competition || 'غير متوفر'}</p>
          ${competitionScore !== undefined ? '<div class="chart-container"><canvas id="competition-chart"></canvas></div>' : ''}
        </div>` : ''}
        
        <div class="result-card">
        <h2>💡 بدائل مقترحة</h2>
        <ul>${(alternatives || []).map((item: string) => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="result-card">
        <h2>✍️ عناوين مقالات</h2>
        <ul>${(suggestedTitles || []).map((item: string) => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="result-card">
        <h2>🔑 كلمات مفتاحية طويلة</h2>
        <ul>${(longTailKeywords || []).map((item: string) => `<li>${item}</li>`).join('')}</ul>
        </div>
    `;

    resultsContainer.innerHTML = resultsHtml;

    // Render charts now that canvases are in the DOM
    if (searchVolumeValue !== undefined) {
        renderSearchVolumeChart(searchVolumeValue);
    }
    if (competitionScore !== undefined) {
        renderCompetitionChart(competitionScore);
    }

    if (sources && sources.length > 0) {
        const sourcesHtml = sources
            .map((source: any) =>
                source.web ? `<li><a href="${source.web.uri}" target="_blank" rel="noopener noreferrer">${source.web.title || source.web.uri}</a></li>` : ''
            )
            .join('');

        if (sourcesHtml) {
            resultsContainer.insertAdjacentHTML('beforeend', `
            <div class="result-card">
                <h2>📚 المصادر (بحث جوجل)</h2>
                <ul>${sourcesHtml}</ul>
            </div>
            `);
        }
    }
}

function renderError(message: string) {
    resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

// --- Settings and Initialization Logic ---

/**
 * Shows the initial setup UI for the user to enter their API key.
 */
function showSetup() {
    settingsPanel.classList.remove('hidden');
    setupMessage.classList.remove('hidden');
    form.classList.add('disabled');
    input.disabled = true;
    countryInput.disabled = true;
    languageInput.disabled = true;
    button.disabled = true;
}

// Event listener for the settings toggle button
settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});

// Event listener for saving the API key and provider
apiKeyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const provider = providerSelect.value as AIProvider;
    const apiKey = apiKeyInput.value.trim();
    if (apiKey && provider) {
        localStorage.setItem('ai_provider', provider);
        localStorage.setItem('api_key', apiKey);
        setupApplication(provider, apiKey);
    }
});

/**
 * Main function to run on script load.
 * Checks for a saved API key and initializes the app or shows the setup UI.
 */
function main() {
    const savedProvider = localStorage.getItem('ai_provider') as AIProvider | null;
    const savedApiKey = localStorage.getItem('api_key');
    
    if (savedProvider && savedApiKey) {
        providerSelect.value = savedProvider;
        apiKeyInput.value = savedApiKey;
        setupApplication(savedProvider, savedApiKey);
    } else {
        showSetup();
    }
}

// Run the application
main();
