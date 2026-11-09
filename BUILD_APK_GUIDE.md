# APK kaise banayein — sirf phone se (Hinglish guide)

Aapke paas laptop/Android Studio nahi hai, phir bhi APK ban sakta hai.
APK banane ka kaam **GitHub ke server** par hoga (~10 minute, free).
Aapko phone par sirf browser chahiye.

---

## Ek baar mein samajh lo (flow)

```
Phone: folder ko ZIP karo  →  GitHub par repo banao  →  ZIP upload karo
   →  Actions tab → "Run workflow"  →  APK download  →  install
```

---

## Step 1 — GitHub account + naya repo

1. Browser mein `github.com` kholo. Account nahi hai to **Sign up** karo (free).
2. Top-right **+** → **New repository**.
3. Naam do: `ascent-ai-trainer` · **Private** chuno · **Create repository**.
4. Repo ban jayega. URL aisa hoga: `github.com/<tumhara-username>/ascent-ai-trainer`

> Repo khali (empty) rakhna — README wagairah add nahi karna. Warna upload mein conflict ho sakta hai.

---

## Step 2 — Project folder ko ZIP karo

MT2 Manager (ya kisi bhi file manager) se:

1. `/storage/emulated/0/MT2/AscentAITrainer` folder par long-press.
2. **Compress / Zip / Add to archive** chuno.
3. `AscentAITrainer.zip` ban jayega.

**Zaroori:** zip ke andar `app.json`, `package.json`, `app/` aur `.github/` folder **root par** hone chahiye — matlab zip kholne par seedha `AscentAITrainer/...` na ho, balki ek hi zip ho jisme yeh files hon. Agar file manager ne extra `AscentAITrainer/` folder ke saath zip kiya, to bhi chalega — bas upload tool mein "strip root folder" option on rakhna.

> `node_modules` folder zip mein nahi hona chahiye (abhi hai bhi nahi, to tension nahi).

---

## Step 3 — ZIP ko GitHub par bhejo

Mobile browsers folder directly upload nahi kar sakte, isliye ek chhota browser tool use karenge jo zip ko extract karke repo mein commit kar deta hai.

### 3.1 Token banao (ek baar)

1. `github.com/settings/tokens` kholo → **Generate new token (classic)**.
2. Note: `apk-build` · Expiration: 30 days.
3. Scopes mein **`repo`** aur **`workflow`** dono tick karo.
   - `workflow` isliye zaroori hai taaki `.github/workflows/build-apk.yml` bhi ja sake.
4. **Generate token** → token copy karo (shuru hota hai `ghp_...`). Yeh password jaisa hai, kisi ko na do.

### 3.2 Upload tool

Browser mein koi bhi ek zip-uploader kholo (sab browser mein hi chalta hai, token sirf GitHub ko jata hai):

- `revatoolskit.com/github-zip-uploader`  ← recommended
- ya `toolbow.com/tools/unlimited-github`

Wahan:
1. Token paste karo.
2. Target repo likho: `tumhara-username/ascent-ai-trainer`, branch `main`.
3. `AscentAITrainer.zip` select karo.
4. **Commit & Push** dabao. (Agar option ho to "strip root folder" ON rakho.)

Ho gaya — ab repo mein saari files dikhengi, including `.github/workflows/build-apk.yml`.

> **Tool use nahi karna?** Fallback: GitHub par repo kholo → **Add file → Upload files** → files chun ke commit karo. Folder structure banane ke liye har subfolder ke andar jaa kar upload karo, aur workflow file ke liye **Add file → Create new file** mein naam likho: `.github/workflows/build-apk.yml` (slash likhte hi folder ban jayega), phir uska content paste karo.

> **`.github/` upload nahi hua?** Yeh hidden folder hai — kuch zip tools ise skip kar dete hain. Is case mein GitHub par khud banao: **Add file → Create new file** → naam `build-apk.yml` se pehle `.github/workflows/` likho → neeche ka content paste karo.

```yaml
name: Build Android APK
on:
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Install dependencies
        run: npm install
      - name: Generate icons and splash
        run: npm run assets
      - name: Generate native Android project
        run: npx expo prebuild --platform android --clean
      - name: Build release APK
        working-directory: android
        run: |
          chmod +x gradlew
          ./gradlew assembleRelease --no-daemon
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: ascent-ai-trainer-apk
          path: android/app/build/outputs/apk/release/*.apk
          if-no-files-found: error
```


---

## Step 4 — Build chalao

1. Repo mein **Actions** tab kholo.
2. Left sidebar mein **Build Android APK** par tap karo.
3. Right par **Run workflow** button dabao → phir **Run workflow** confirm karo.

> Button na dikhe? Matlab workflow file `main` branch par nahi pahunchi. Step 3 dobara dekho.

4. Run start ho jayega (peela dot 🟡 = chal raha hai). ~10 minute lagenge.
5. 🟢 Green tick = ban gaya. ❌ Red = fail (neeche troubleshooting).

Aap GitHub Mobile app se bhi run kar sakte ho: repo → Actions → workflow → Run workflow.

---

## Step 5 — APK download + install

1. Run kholo → neeche **Artifacts** section.
2. **ascent-ai-trainer-apk** par tap → zip download hogi.
3. Us zip ko kholo → andar `app-release.apk` milega.
4. APK par tap → **Install** (Settings mein "Install unknown apps" allow karna pad sakta hai).

Bas! App khul jayegi. Pehli baar `thk_live_...` key paste karo (tokenharbor.ai se) aur onboarding shuru.

---

## Troubleshooting

**Workflow "Run" button nahi dikh raha**
→ `.github/workflows/build-apk.yml` file `main` branch par honi chahiye. Repo mein check karo.

**Build fail — `npm install` error**
→ `package.json` aur `app.json` upload hue ya nahi dekho. `node_modules` upload nahi karna.

**Build fail — assets/icon not found**
→ Chinta mat karo, workflow khud `npm run assets` chalata hai. Agar phir bhi aaye to workflow file purani hai — repo mein latest `.github/workflows/build-apk.yml` honi chahiye.

**APK install nahi ho raha**
→ "Install unknown apps" permission do. Purani version ho to pehle uninstall karo.

**GitHub bina koi aur tarika?**
→ Expo EAS (needs computer): `npx eas build -p android --profile preview`. `eas.json` mein `preview` profile already APK banata hai.

---

## Yaad rakho

- APK **GitHub ke runner** par banta hai — aapke phone par nahi.
- Repo **private** rakho, kyunki source aapka hai (aur token kabhi commit na karo).
- Har baar code badalne ke baad: naya commit → Actions → Run workflow → naya APK.
