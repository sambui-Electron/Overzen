<div align="center">

<img src="website/img/Logo.png" width="88" alt="Overzen logo">

# Overzen

**AI, but calmer.**

A small, always-on-top overlay window for talking to local and cloud AI models without breaking focus.

[![Stars](https://img.shields.io/github/stars/sambui-Electron/Overzen?style=flat-square&color=ff6b57&labelColor=1e1e1e)](https://github.com/sambui-Electron/Overzen/stargazers)
[![License](https://img.shields.io/github/license/sambui-Electron/Overzen?style=flat-square&color=ff6b57&labelColor=1e1e1e)](https://github.com/sambui-Electron/Overzen/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/website-live-ff6b57?style=flat-square&labelColor=1e1e1e)](https://sambui-electron.github.io/Overzen/)

[**Live site**](https://sambui-electron.github.io/Overzen/) · [**Download for Windows**](https://github.com/sambui-Electron/Overzen/releases)

</div>
> A small, always-on-top overlay window for talking to local and cloud AI models without breaking focus.

🔗 **[Live site](https://sambui-electron.github.io/Overzen/)** · 📥 [Download for Windows](https://github.com/sambui-Electron/Overzen/releases)
**Overzen** is an open-source web user interface (Web UI) that serves as a highly flexible graphical user interface (GUI) container for AI models.

## ✨ Features

- **Zen Mode** — collapse Overzen into a small, frameless, semi-transparent overlay that floats always-on-top of your other windows, so your AI chat stays one glance away without stealing screen space or cluttering your desktop.
- Connect to any local or cloud OpenAI-compatible backend
- Adjustable overlay transparency with live preview
- Light/dark theme support

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

## 🚀 Getting Started

1. Go to the [Releases](https://github.com/sambui-Electron/Overzen/releases) page and download the latest installer (`Overzen-Setup-x.x.x.exe`).
2. Run the installer and follow the setup steps.
3. Launch Overzen, open **Settings**, and choose your AI source:
   * **Local** — pick your runner (Ollama, LM Studio, llama.cpp, or Custom) and confirm the port.
   * **Cloud API** — enter your provider's base URL, model name, and API key.
4. Start chatting, or click the leaf icon to enter **Zen Mode** for a compact overlay view.

## 💻 Windows Installation Notes

### SmartScreen Warning
Since Overzen is an open-source project and not yet digitally signed, Windows SmartScreen may show a **"Windows protected your PC"** popup when you run the app for the first time.

To bypass this and run Overzen:
1. Click on the **"More info"** text link inside the popup.
2. Click the **"Run anyway"** button that appears.

### Smart App Control
On some systems, Windows' **Smart App Control** may block Overzen outright with no override option at all — this is separate from SmartScreen and stricter. If this happens:
1. Open **Windows Security → App & browser control → Smart App Control**.
2. Switch it **Off**.
3. Install and run Overzen.
4. Switch Smart App Control back **On** afterward if you'd like to keep it enabled.

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

### Still Having Issues?
If your problem is not listed above, please check our active bug reports or open a new ticket here:
[Report an Issue / Ask for Help](https://github.com/sambui-Electron/Overzen/issues)

## 📄 License & Disclaimer

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for the full text.

> **Disclaimer:** Overzen is provided "as is", without warranty of any kind. If Overzen causes any issues, errors, or breaks anything in your system, the Overzen team holds absolutely no responsibility or liability for damages, and is not obligated to provide any financial compensation. Please use it at your own risk.
