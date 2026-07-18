# Overzen

**Overzen** is an open-source web user interface (Web UI) that serves as a highly flexible graphical user interface (GUI) container for AI models.

## ⚠️ Requirements & Compatibility
Overzen **does not** include any built-in AI models. It acts as a frontend client that connects to backend providers. 

To use Overzen, you must connect it to any platform that provides an **OpenAI-compatible API endpoint**. This includes:

### 1. Local AI Runners (Offline)
* **Ollama**
* **LM Studio**
* **llama.cpp**
* *And any other local LLM backends...*

### 2. Cloud AI Providers (Online)
* **OpenAI** (ChatGPT API)
* **DeepSeek**, **Groq**, **Together AI**, **Anyscale**, etc.
* *Any third-party provider supporting OpenAI-compatible routing.*

## 💻 Windows Installation Note (SmartScreen Warning)
Since Overzen is an open-source project and not digitally signed, Windows SmartScreen may show a **"Windows protected your PC"** popup when you run the app for the first time. 

To bypass this and run Overzen:
1. Click on the **"More info"** text link inside the popup.
2. Click the **"Run anyway"** button that appears.

## 🛠️ Troubleshooting

### 1. Connection Error / API Refused
* **Symptoms:** The app cannot connect to your local AI runner or cloud provider.
* **Solutions:** 
  * Ensure your local runner (e.g., Ollama, LM Studio) is currently running.
  * Check if your API Key or Base URL is correct.
  * If using a local runner, ensure CORS is enabled on your backend settings.

### 2. Models Not Loading
* **Symptoms:** The UI is connected, but the model dropdown list is empty.
* **Solutions:**
  * Verify that you have already downloaded at least one model in your AI runner.
  * Refresh the connection inside Overzen settings.

###  Still Having Issues?
If your problem is not listed above, please check our active bug reports or open a new ticket here:
 [Report an Issue / Ask for Help](https://github.com/sambui-Electron/Overzen/issues) 

## 📄 License & Disclaimer
This project is licensed under the **MIT License**.

> **Disclaimer:** Overzen is provided "as is", without warranty of any kind. If Overzen causes any issues, errors, or breaks anything in your system, the Overzen team holds absolutely no responsibility or liability for damages, and is not obligated to provide any financial compensation. Please use it at your own risk.
