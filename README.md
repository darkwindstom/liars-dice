# Liar's Dice (吹牛) - Neon Lounge Web Game

一個極具視覺衝擊力、融入霓虹酒吧氛圍的 **「吹牛 (Liar's Dice)」** 網頁遊戲。包含**單人離線對戰 (打電腦)** 及**多人線上即時連線房**兩種模式。

---

## 🌟 遊戲特色

1. **單人離線對打**：內置三種不同策略風格的 AI 角色 (🧔巴曼山姆、👩‍🎤榮耀蒂娜、🤠賭徒傑克)，具備豐富的挑釁/聊天對白。
2. **多人線上房**：支持最多 4 名玩家透過房間代碼 (Room Code) 連線對決，支持主辦人踢人、新增 AI 玩家、變更規則等同步功能。
3. **音效合成引擎**：使用 Web Audio API 技術在瀏覽器中動態合成搖骰子、蓋杯子、挑戰成功/失敗的樂曲音效（無需下載大型音訊檔）。
4. **機率輔助分析**：側邊欄內建二項式分佈 (Binomial Distribution) 機率計算器，動態分析點數期望值，輔助玩家決策。
5. **精美 3D 質感骰子**：全部介面採用白色高解析度 3D 陰影骰子圖示，取消傳統 Unicode 文字圖示，極大提升視覺效果。

---

## 🛠️ 開發與編譯指南

本專案採用 **Vite** 作為前端開發建置工具，**Node.js (Express + Socket.io)** 作為連線伺服器。

### 1. 安裝前置作業
確保您的電腦上已安裝 [Node.js](https://nodejs.org/) (建議版本 v18 或以上)。

### 2. 下載專案並安裝依賴
複製此倉庫並進入專案目錄：
```bash
git clone https://github.com/darkwindstom/liars-dice.git
cd liars-dice
```
安裝所有必需的 NPM 套件：
```bash
npm install
```

### 3. 本地開發運行

#### A. 啟動後端連線伺服器
遊戲的多人連線以及安全骰子資料是在 Port 3000 上運作：
```bash
node server.js
```

#### B. 啟動前端開發伺服器
在另一個終端機視窗中，啟動 Vite 前端服務：
```bash
npm run dev
```
啟動後，瀏覽器打開 [http://localhost:5173/](http://localhost:5173/) 即可開始遊玩！

---

## 📦 生產環境編譯 (Build)

如果您想要將本遊戲部署至公開伺服器（例如 Vercel, Netlify 或自建的 Nginx 伺服器）：

### 1. 編譯靜態資源
執行以下指令來進行生產環境打包：
```bash
npm run build
```
打包完成後，會在專案根目錄下生成一個 **`dist`** 資料夾。這個資料夾內包含了高度優化、壓縮過後的 HTML、CSS 與 JS 靜態檔案。

### 2. 部署說明
* **前端 (Client)**：將 `dist` 資料夾內的所有檔案上傳至您的靜態網頁託管平台（Vercel, Netlify, Github Pages 等）。
* **後端 (Server)**：將 `server.js` 與 `package.json` 部署至 Node.js 執行主機（如 Heroku, Render, Fly.io 或自建的 VPS）。
* **伺服器連線網址設定**：在正式部署時，請修改 `src/main.js` 中的伺服器連接位址，將其從 `localhost:3000` 改為您部署後的真實後端伺服器 URL。
