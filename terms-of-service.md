# Terms of Service for Rage Bait Detector Userscript

**Last Updated:** July 5, 2025

By installing and using the "Rage Bait Detector" userscript ("the Script"), you agree to these Terms of Service. Please read them carefully.

---

## 1. Disclaimers and External Terms

**IMPORTANT:**  
This Script operates within the environment of other platforms. By using this Script, you acknowledge and agree that your use is also governed by, and subject to, the Terms of Service and Privacy Policies of the following third-party services:

- **Facebook** (Meta Platforms, Inc.)
- **X** (formerly Twitter)
- **GroqCloud** (Groq, Inc.)

You are solely responsible for complying with the terms and policies of these services.  
This Script is an independent tool and is **not officially endorsed by, affiliated with, or responsible for** any of these platforms.

---

## 2. Nature of the Detector and Accuracy

The Rage Bait Detector is designed to assist in identifying potential "rage bait" content.

- **Heuristic-Based Detection:**  
  The Script primarily uses a heuristic algorithm for initial detection. This means it relies on predefined rules and patterns, which are inherently prone to false positives and negatives.

- **AI-Powered Analysis (Conditional):**  
  If the heuristic score of a post is **equal to or greater than 5**, the Script will send the post's text content to the GroqCloud AI API for further analysis.

- **No Guarantees of Perfection:**  
  **THIS DETECTOR IS NOT PERFECT.**  
  It is a tool to assist, not a definitive authority.  
  You must not fully rely on its results for making critical judgments or decisions. The responsibility for interpretation and action remains with you.

---

## 3. Data Handling and Potential Risks

- **Feed Fetching:**  
  The Script fetches text content from your Facebook/X feed to perform its analysis.

- **AI Analysis and Data Transmission:**  
  When a post's heuristic score meets the threshold (≥ 5), its text content is transmitted to the GroqCloud API.

- **Potential for Data Leakage:**  
  While we strive to ensure the security of the Script, you acknowledge that there is a potential risk of your data being exposed or mishandled due to:
    - **GroqCloud Database / System Issues:** Any vulnerabilities or breaches within GroqCloud's infrastructure.
    - **GroqCloud's Own Policies:** How GroqCloud handles and stores data submitted to their API (refer to GroqCloud's ToS and Privacy Policy).
    - **Our Script's Issues:** Unforeseen bugs or vulnerabilities within the Userscript itself.

  By using this Script, you **assume these risks** and understand that we cannot guarantee the absolute security or privacy of data sent to third-party APIs.

---

## 4. Reporting Issues and Misuse

- **Userscript Injection:**  
  This Script requires userscript injection (via Tampermonkey or similar extensions) to function.

- **Reporting Misinterpretations:**  
  If the detector provides a "wrong decision" (e.g., a false positive or false negative) regarding content, this is generally a limitation of the heuristic or AI model, not a malfunction.

- **Reporting Exploits:**  
  You are encouraged to report any actual security exploits or vulnerabilities within the Script that could be harmful or useful for malicious actors.  
  Such reports should be made directly to the developer.

---

## 5. Imperfection and Responsibility

- **AI for Debugging:**  
  This Script utilizes AI for debugging and bug finding, which means it is in continuous development and **IS NOT PERFECT**.

- **User Responsibility:**  
  You are solely responsible for how you interpret and act upon the information provided by this Script.  
  We are **not liable** for any consequences arising from your reliance on the Script's output.

---

By continuing to use the Rage Bait Detector, you confirm that you have **read, understood, and agreed** to these Terms of Service.
