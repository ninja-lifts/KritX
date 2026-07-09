/*
 * Market — the "why should I do this, and what's it worth?" engine.
 *
 * Everyone loves progress you can feel — and money is a big motivator. This
 * module maps a skill to an offline snapshot of demand, pay ranges, and ways
 * to turn it into income, so every task can answer "is this worth my time?".
 *
 * Numbers are illustrative 2026 estimates meant for motivation and rough
 * direction — not financial advice. They're editable in code and easy to
 * refresh. USD figures are global-ish; INR figures lean toward India.
 */

const MARKET = [
  {
    keys: ["ai", "machine learning", "ml", "deep learning", "llm", "pytorch", "tensorflow", "neural"],
    name: "AI / Machine Learning",
    category: "Coding",
    trend: "hot",
    demand: "Explosive",
    salary: { entry: "$70k–110k", mid: "$120k–180k", senior: "$200k–400k+" },
    salaryInr: "₹8L–45L+ / yr",
    freelance: "$40–150 / hr",
    why: "The single most in-demand skill of the decade. Every company wants it, and there are far more openings than people who can actually build.",
    monetize: ["High-paying jobs", "Consulting / contracts", "Build & sell AI tools", "Paid tutorials & courses"],
  },
  {
    keys: ["prompt", "prompt engineering", "chatgpt", "generative"],
    name: "Prompt Engineering / Applied GenAI",
    category: "Coding",
    trend: "hot",
    demand: "Very high",
    salary: { entry: "$50k–80k", mid: "$90k–140k", senior: "$150k–250k" },
    salaryInr: "₹6L–30L / yr",
    freelance: "$30–120 / hr",
    why: "Low barrier to entry, huge leverage. You can turn AI into products and services without a CS degree.",
    monetize: ["Freelance AI automations", "Sell GPT workflows", "Content & newsletters", "Agency work"],
  },
  {
    keys: ["react", "frontend", "front-end", "javascript", "js", "html", "css", "vue", "angular", "web dev", "web development", "tailwind"],
    name: "Web / Frontend Development",
    category: "Coding",
    trend: "hot",
    demand: "Very high",
    salary: { entry: "$45k–75k", mid: "$80k–120k", senior: "$130k–180k" },
    salaryInr: "₹4L–25L / yr",
    freelance: "$25–90 / hr",
    why: "The most common entry point into tech. Endless freelance gigs, and you can show a live portfolio from day one.",
    monetize: ["Jobs everywhere", "Freelance sites & agencies", "Build SaaS products", "Sell templates/themes"],
  },
  {
    keys: ["backend", "back-end", "node", "python", "django", "api", "java", "spring", "go", "rust", "server"],
    name: "Backend Development",
    category: "Coding",
    trend: "rising",
    demand: "Very high",
    salary: { entry: "$50k–80k", mid: "$90k–140k", senior: "$150k–220k" },
    salaryInr: "₹5L–30L / yr",
    freelance: "$30–110 / hr",
    why: "The engine behind every app. Harder to fake, so it's better paid and more defensible than frontend alone.",
    monetize: ["Product companies", "Freelance systems work", "Build APIs as a service", "Technical consulting"],
  },
  {
    keys: ["mobile", "android", "ios", "flutter", "react native", "kotlin", "swift", "app dev"],
    name: "Mobile App Development",
    category: "Coding",
    trend: "stable",
    demand: "High",
    salary: { entry: "$50k–80k", mid: "$90k–140k", senior: "$140k–200k" },
    salaryInr: "₹5L–28L / yr",
    freelance: "$30–100 / hr",
    why: "Billions of phones, and every business wants an app. You can also publish your own and earn passively.",
    monetize: ["App-dev jobs", "Client apps (freelance)", "Publish your own app (ads/IAP)", "App templates"],
  },
  {
    keys: ["data", "data science", "analytics", "sql", "pandas", "statistics", "data analyst"],
    name: "Data Science / Analytics",
    category: "Coding",
    trend: "hot",
    demand: "Very high",
    salary: { entry: "$55k–85k", mid: "$95k–150k", senior: "$160k–250k" },
    salaryInr: "₹6L–35L / yr",
    freelance: "$35–120 / hr",
    why: "Every company is drowning in data and starving for insight. Blends nicely with AI for even higher pay.",
    monetize: ["Analyst / DS roles", "Dashboards for clients", "Paid research reports", "Teaching & courses"],
  },
  {
    keys: ["devops", "cloud", "aws", "azure", "gcp", "kubernetes", "docker", "terraform", "sre"],
    name: "DevOps / Cloud Engineering",
    category: "Coding",
    trend: "hot",
    demand: "Very high",
    salary: { entry: "$60k–90k", mid: "$110k–160k", senior: "$170k–280k" },
    salaryInr: "₹7L–40L / yr",
    freelance: "$45–150 / hr",
    why: "One of the best pay-to-effort ratios in tech, and certifications (AWS/Azure) fast-track you past a degree.",
    monetize: ["Cloud engineer roles", "Cloud cost consulting", "Certifications = raises", "Infra contracting"],
  },
  {
    keys: ["security", "cyber", "cybersecurity", "pentest", "hacking", "infosec", "ethical hacking"],
    name: "Cybersecurity",
    category: "Coding",
    trend: "hot",
    demand: "Very high (talent shortage)",
    salary: { entry: "$60k–90k", mid: "$100k–150k", senior: "$160k–300k" },
    salaryInr: "₹6L–40L / yr",
    freelance: "$50–200 / hr",
    why: "A permanent global talent shortage means strong job security and rising pay. Bug bounties can pay instantly.",
    monetize: ["Security roles", "Bug bounties (pay per find)", "Audits & pentests", "Training"],
  },
  {
    keys: ["blockchain", "web3", "solidity", "crypto", "smart contract"],
    name: "Blockchain / Web3",
    category: "Coding",
    trend: "volatile",
    demand: "Niche but high-paying",
    salary: { entry: "$60k–100k", mid: "$120k–180k", senior: "$180k–350k" },
    salaryInr: "₹7L–40L / yr",
    freelance: "$50–200 / hr",
    why: "Small talent pool + high budgets = premium rates. Volatile, but rewards those who ride the up-cycles.",
    monetize: ["Web3 roles", "Smart-contract audits", "Freelance dApps", "Your own token/product"],
  },
  {
    keys: ["game", "game dev", "unity", "unreal", "godot", "gamedev"],
    name: "Game Development",
    category: "Coding",
    trend: "stable",
    demand: "Moderate (competitive)",
    salary: { entry: "$45k–70k", mid: "$80k–120k", senior: "$130k–190k" },
    salaryInr: "₹4L–22L / yr",
    freelance: "$25–90 / hr",
    why: "The most fun way to learn to code, and a hit indie game can change your life. Passion-driven and creative.",
    monetize: ["Studio jobs", "Sell your own games", "Asset store sales", "Contract game work"],
  },
  {
    keys: ["ui", "ux", "design", "figma", "product design", "ui/ux", "interaction"],
    name: "UI / UX Design",
    category: "Design",
    trend: "rising",
    demand: "High",
    salary: { entry: "$45k–70k", mid: "$80k–120k", senior: "$130k–190k" },
    salaryInr: "₹4L–25L / yr",
    freelance: "$30–120 / hr",
    why: "Great pay without heavy coding. Strong portfolios win clients fast, and good designers are always short in supply.",
    monetize: ["Product/design roles", "Freelance app & web design", "Sell UI kits", "Design coaching"],
  },
  {
    keys: ["graphic", "graphic design", "illustrator", "photoshop", "branding", "logo"],
    name: "Graphic Design / Branding",
    category: "Design",
    trend: "stable",
    demand: "Moderate",
    salary: { entry: "$35k–55k", mid: "$55k–85k", senior: "$90k–130k" },
    salaryInr: "₹3L–15L / yr",
    freelance: "$20–80 / hr",
    why: "Easy to start freelancing part-time. Every brand needs visuals, and you can stack it with motion/AI tools.",
    monetize: ["Freelance gigs", "Logo & brand packages", "Print-on-demand", "Sell templates"],
  },
  {
    keys: ["video", "video editing", "premiere", "davinci", "editor", "youtube edit"],
    name: "Video Editing",
    category: "Creative",
    trend: "hot",
    demand: "Very high",
    salary: { entry: "$35k–55k", mid: "$55k–90k", senior: "$90k–140k" },
    salaryInr: "₹3L–18L / yr",
    freelance: "$25–90 / hr",
    why: "The creator economy runs on video. Editors are in massive demand and can work fully remote for global clients.",
    monetize: ["Retainer with creators", "Freelance per-video", "Run an editing agency", "Sell presets/LUTs"],
  },
  {
    keys: ["3d", "blender", "modeling", "animation", "vfx", "motion"],
    name: "3D / Motion / VFX",
    category: "Creative",
    trend: "rising",
    demand: "High",
    salary: { entry: "$40k–65k", mid: "$70k–110k", senior: "$120k–180k" },
    salaryInr: "₹4L–20L / yr",
    freelance: "$30–120 / hr",
    why: "Blends art and tech; used in film, ads, games, and product viz. Blender is free, so the only cost is time.",
    monetize: ["Studio roles", "Freelance renders", "Sell 3D assets", "Product visualization"],
  },
  {
    keys: ["marketing", "digital marketing", "ads", "growth", "social media", "meta ads", "google ads"],
    name: "Digital Marketing",
    category: "Business",
    trend: "rising",
    demand: "High",
    salary: { entry: "$40k–60k", mid: "$65k–100k", senior: "$110k–170k" },
    salaryInr: "₹4L–22L / yr",
    freelance: "$25–100 / hr",
    why: "Directly tied to revenue, so businesses pay well. Results are measurable, which makes you easy to hire and keep.",
    monetize: ["In-house roles", "Run ads for clients", "Marketing agency", "Affiliate income"],
  },
  {
    keys: ["seo", "search engine"],
    name: "SEO",
    category: "Business",
    trend: "stable",
    demand: "High",
    salary: { entry: "$40k–60k", mid: "$65k–100k", senior: "$110k–160k" },
    salaryInr: "₹4L–20L / yr",
    freelance: "$25–90 / hr",
    why: "Compounding, long-term traffic = long-term client value. Pairs perfectly with content and AI writing.",
    monetize: ["SEO specialist roles", "Freelance audits", "Rank-and-rent sites", "Niche affiliate sites"],
  },
  {
    keys: ["writing", "content", "content writing", "blog", "copywriting", "copy"],
    name: "Writing / Copywriting",
    category: "Business",
    trend: "stable",
    demand: "Moderate–High",
    salary: { entry: "$35k–55k", mid: "$60k–95k", senior: "$100k–160k" },
    salaryInr: "₹3L–18L / yr",
    freelance: "$20–100 / hr",
    why: "Copywriting (words that sell) is one of the highest-ROI skills you can freelance. Start with zero equipment.",
    monetize: ["Freelance writing", "Sales copy (high rates)", "Ghostwriting", "Your own newsletter"],
  },
  {
    keys: ["excel", "spreadsheet", "google sheets", "vba"],
    name: "Excel / Spreadsheets & Automation",
    category: "Business",
    trend: "stable",
    demand: "High (underrated)",
    salary: { entry: "$35k–50k", mid: "$55k–85k", senior: "$90k–130k" },
    salaryInr: "₹3L–14L / yr",
    freelance: "$20–70 / hr",
    why: "Boring but everywhere. Advanced Excel + automation quietly powers finance, ops, and analytics jobs.",
    monetize: ["Analyst/ops roles", "Build dashboards for SMBs", "Automate client workflows", "Sell templates"],
  },
  {
    keys: ["product", "product management", "pm", "product manager"],
    name: "Product Management",
    category: "Business",
    trend: "stable",
    demand: "High",
    salary: { entry: "$70k–100k", mid: "$110k–160k", senior: "$170k–300k" },
    salaryInr: "₹8L–45L / yr",
    freelance: "$50–150 / hr",
    why: "Sits at the center of tech companies. High pay and a clear path to leadership; great if you like strategy + people.",
    monetize: ["PM roles", "Fractional/consulting PM", "Build your own product", "Coaching"],
  },
  {
    keys: ["sales", "closing", "b2b sales", "cold call"],
    name: "Sales",
    category: "Business",
    trend: "stable",
    demand: "Always hiring",
    salary: { entry: "$40k + commission", mid: "$80k–150k OTE", senior: "$150k–400k+ OTE" },
    salaryInr: "₹4L–35L+ / yr",
    freelance: "Commission-based",
    why: "Uncapped income — top closers out-earn most engineers. No degree needed; results speak for themselves.",
    monetize: ["Commission roles", "Remote closing", "Freelance appointment setting", "Your own offer"],
  },
  {
    keys: ["photography", "photo", "photographer"],
    name: "Photography",
    category: "Creative",
    trend: "stable",
    demand: "Moderate",
    salary: { entry: "$25k–45k", mid: "$45k–80k", senior: "$80k–150k" },
    salaryInr: "₹2L–15L / yr",
    freelance: "$50–300 / shoot",
    why: "Turn a hobby into weekend income fast (events, portraits, products). Stock photos can earn passively too.",
    monetize: ["Event/portrait gigs", "Product photography", "Stock libraries", "Prints & workshops"],
  },
  {
    keys: ["music", "music production", "producer", "beats", "audio", "fl studio", "ableton"],
    name: "Music Production",
    category: "Creative",
    trend: "stable",
    demand: "Moderate (competitive)",
    salary: { entry: "Variable", mid: "$40k–80k", senior: "$90k–200k+" },
    salaryInr: "Variable",
    freelance: "$30–150 / track",
    why: "Passion skill with real income paths: beat sales, sync licensing, and mixing gigs for other artists.",
    monetize: ["Sell beats online", "Mixing/mastering gigs", "Sync licensing", "Teach production"],
  },
  {
    keys: ["language", "spanish", "french", "german", "english", "japanese", "ielts"],
    name: "Language Learning",
    category: "Personal",
    trend: "stable",
    demand: "Indirect",
    salary: { entry: "—", mid: "+10–20% pay bump", senior: "Unlocks global roles" },
    salaryInr: "Opens higher-pay roles",
    freelance: "$15–50 / hr (tutoring)",
    why: "A multiplier on every other skill: unlocks remote jobs, higher pay bands, and clients in richer markets.",
    monetize: ["Online tutoring", "Translation gigs", "Access higher-pay markets", "Travel + remote work"],
  },
  {
    keys: ["fitness", "gym", "workout", "training", "personal trainer", "health"],
    name: "Fitness / Personal Training",
    category: "Personal",
    trend: "rising",
    demand: "High",
    salary: { entry: "$30k–45k", mid: "$50k–80k", senior: "$90k–200k (online)" },
    salaryInr: "₹2L–20L / yr",
    freelance: "$30–100 / session",
    why: "Improves everything else in your life, and online coaching scales income far beyond in-person sessions.",
    monetize: ["1:1 coaching", "Online programs", "Content + sponsorships", "Gym/studio work"],
  },
  {
    keys: ["cooking", "chef", "baking", "culinary"],
    name: "Cooking / Culinary",
    category: "Personal",
    trend: "stable",
    demand: "Moderate",
    salary: { entry: "$25k–40k", mid: "$40k–70k", senior: "$80k–150k" },
    salaryInr: "₹2L–12L / yr",
    freelance: "Varies",
    why: "A joyful daily-life skill that can become a cloud kitchen, catering side-hustle, or a big food channel.",
    monetize: ["Home/cloud kitchen", "Catering", "Recipe content", "Cooking classes"],
  },
  {
    keys: ["trading", "investing", "stocks", "finance", "forex", "crypto trading"],
    name: "Trading / Investing",
    category: "Business",
    trend: "volatile",
    demand: "Self-directed",
    salary: { entry: "Capital-based", mid: "Capital-based", senior: "Uncapped / high-risk" },
    salaryInr: "Capital-dependent",
    freelance: "—",
    why: "Builds financial literacy that compounds for life. High risk, so learn with small amounts first — knowledge pays even if you never trade full-time.",
    monetize: ["Grow your own capital", "Financial-content creation", "Analyst roles", "Managing others' funds (licensed)"],
  },
  {
    keys: ["nocode", "no-code", "bubble", "webflow", "automation", "zapier", "make"],
    name: "No-Code / Automation",
    category: "Coding",
    trend: "rising",
    demand: "High",
    salary: { entry: "$40k–60k", mid: "$70k–110k", senior: "$120k–180k" },
    salaryInr: "₹4L–20L / yr",
    freelance: "$30–120 / hr",
    why: "Build real apps and automations without deep coding. Fastest path from idea to paying client.",
    monetize: ["Build client tools", "Automation consulting", "Sell templates", "Launch micro-SaaS"],
  },
  {
    keys: ["data engineering", "etl", "airflow", "spark", "dbt", "data pipeline", "warehouse", "snowflake", "bigquery"],
    name: "Data Engineering",
    category: "Coding",
    trend: "rising",
    demand: "Very high",
    salary: { entry: "$70k–100k", mid: "$110k–160k", senior: "$170k–260k" },
    salaryInr: "₹8L–40L / yr",
    freelance: "$40–130 / hr",
    why: "The plumbing behind all data & AI. Fewer people do it than data science, so it pays more and is harder to automate away.",
    monetize: ["Data engineer roles", "Freelance pipelines", "Consulting", "Platform contracts"],
  },
  {
    keys: ["embedded", "iot", "firmware", "arduino", "esp32", "microcontroller", "robotics"],
    name: "Embedded / IoT & Robotics",
    category: "Coding",
    trend: "rising",
    demand: "High",
    salary: { entry: "$65k–95k", mid: "$100k–150k", senior: "$150k–210k" },
    salaryInr: "₹6L–30L / yr",
    freelance: "$40–120 / hr",
    why: "Software meets hardware — powers robots, wearables, cars, and smart devices. A niche with less competition.",
    monetize: ["Embedded roles", "Hardware startups", "Freelance IoT builds", "Your own device"],
  },
  {
    keys: ["ar", "vr", "xr", "augmented reality", "virtual reality", "spatial", "metaverse", "unity xr"],
    name: "AR / VR / XR",
    category: "Coding",
    trend: "rising",
    demand: "Emerging–High",
    salary: { entry: "$70k–100k", mid: "$100k–160k", senior: "$160k–230k" },
    salaryInr: "₹7L–32L / yr",
    freelance: "$40–120 / hr",
    why: "Spatial computing is the next platform (headsets, smart glasses). Get in early while the talent pool is small.",
    monetize: ["XR dev roles", "Freelance experiences", "Sell 3D/AR assets", "Your own app"],
  },
  {
    keys: ["quant", "algorithmic trading", "algo trading", "quantitative", "backtesting"],
    name: "Quant / Algorithmic Trading",
    category: "Business",
    trend: "hot",
    demand: "High (elite pay)",
    salary: { entry: "$100k–150k", mid: "$150k–300k", senior: "$300k–800k+" },
    salaryInr: "₹15L–1Cr+ / yr",
    freelance: "Capital / bonus based",
    why: "Where coding meets money markets. Among the highest-paid technical roles on earth — and the skills also let you trade your own capital.",
    monetize: ["Quant/HFT firms", "Trade your own capital", "Build trading tools", "Fintech roles"],
  },
];

/* Fields of interest → the opportunities inside them and a concrete
   learning path (skills to build, in order) that you can add as tasks. */
const FIELDS = [
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    icon: "🛡️",
    trend: "hot",
    blurb:
      "Protect systems and data from attackers. A permanent global talent shortage means strong pay and job security.",
    opportunities: [
      { role: "SOC Analyst", pay: "$60k–95k", note: "Entry-friendly, monitors & responds to threats" },
      { role: "Penetration Tester", pay: "$90k–150k", note: "Legally hack systems to find holes" },
      { role: "Security Engineer", pay: "$110k–180k", note: "Builds defenses into products" },
      { role: "Bug Bounty Hunter", pay: "Pay per find", note: "Freelance, get paid for each vulnerability" },
    ],
    path: [
      { skill: "Networking fundamentals", category: "Coding", why: "You can't secure what you don't understand — TCP/IP, DNS, HTTP." },
      { skill: "Linux", category: "Coding", why: "Most servers and security tools run on Linux." },
      { skill: "Python scripting", category: "Coding", why: "Automate scans and write your own security tools." },
      { skill: "Ethical hacking / pentesting", category: "Coding", why: "Learn attacker techniques to defend against them." },
      { skill: "Cloud security (AWS/Azure)", category: "Coding", why: "Everything is moving to the cloud." },
    ],
  },
  {
    id: "ai",
    name: "AI & Machine Learning",
    icon: "🤖",
    trend: "hot",
    blurb:
      "Build systems that learn. The most in-demand and highest-paid field of the decade.",
    opportunities: [
      { role: "ML Engineer", pay: "$120k–200k", note: "Ships models into products" },
      { role: "Data Scientist", pay: "$95k–160k", note: "Turns data into predictions" },
      { role: "AI Product Builder", pay: "Freelance/startup", note: "Build & sell AI tools" },
      { role: "Prompt / GenAI Specialist", pay: "$90k–150k", note: "Low barrier, high leverage" },
    ],
    path: [
      { skill: "Python", category: "Coding", why: "The language of AI." },
      { skill: "Math foundations (stats & linear algebra)", category: "Coding", why: "Understand what models actually do." },
      { skill: "Data analysis (Pandas)", category: "Coding", why: "Clean and explore data before modeling." },
      { skill: "Machine learning basics", category: "Coding", why: "Core algorithms and how to train them." },
      { skill: "Deep learning (PyTorch)", category: "Coding", why: "Neural nets power modern AI." },
    ],
  },
  {
    id: "web",
    name: "Web Development",
    icon: "🌐",
    trend: "hot",
    blurb:
      "Build websites and web apps. The most common entry point into tech with endless freelance work.",
    opportunities: [
      { role: "Frontend Developer", pay: "$60k–120k", note: "Builds what users see" },
      { role: "Full-Stack Developer", pay: "$80k–150k", note: "Front + back, most hireable" },
      { role: "Freelance Web Dev", pay: "$25–90/hr", note: "Client sites & apps" },
      { role: "SaaS Founder", pay: "Uncapped", note: "Build & sell your own product" },
    ],
    path: [
      { skill: "HTML & CSS", category: "Coding", why: "Structure and style every page." },
      { skill: "JavaScript", category: "Coding", why: "Makes pages interactive." },
      { skill: "React", category: "Coding", why: "The most in-demand frontend framework." },
      { skill: "Backend (Node.js)", category: "Coding", why: "APIs, databases, auth." },
      { skill: "Deployment & databases", category: "Coding", why: "Ship real apps to the internet." },
    ],
  },
  {
    id: "data",
    name: "Data & Analytics",
    icon: "📊",
    trend: "hot",
    blurb:
      "Turn raw data into decisions. Every company is drowning in data and starving for insight.",
    opportunities: [
      { role: "Data Analyst", pay: "$55k–95k", note: "Great entry point, dashboards & reports" },
      { role: "Data Scientist", pay: "$95k–160k", note: "Predictive modeling" },
      { role: "BI Developer", pay: "$80k–130k", note: "Business intelligence tooling" },
      { role: "Freelance Analyst", pay: "$35–120/hr", note: "Dashboards for clients" },
    ],
    path: [
      { skill: "Excel / Spreadsheets", category: "Business", why: "The universal data tool." },
      { skill: "SQL", category: "Coding", why: "Query data from any database." },
      { skill: "Python (Pandas)", category: "Coding", why: "Analyze data at scale." },
      { skill: "Data visualization (Power BI / Tableau)", category: "Business", why: "Communicate findings clearly." },
      { skill: "Statistics", category: "Coding", why: "Know what the numbers really mean." },
    ],
  },
  {
    id: "cloud",
    name: "Cloud & DevOps",
    icon: "☁️",
    trend: "hot",
    blurb:
      "Run and scale software reliably. One of the best pay-to-effort ratios in tech; certs fast-track you.",
    opportunities: [
      { role: "Cloud Engineer", pay: "$100k–170k", note: "Builds on AWS/Azure/GCP" },
      { role: "DevOps Engineer", pay: "$110k–180k", note: "Automates deployment pipelines" },
      { role: "Site Reliability Engineer", pay: "$130k–220k", note: "Keeps systems up at scale" },
      { role: "Cloud Consultant", pay: "$45–150/hr", note: "Freelance cost & infra advice" },
    ],
    path: [
      { skill: "Linux", category: "Coding", why: "The OS of the cloud." },
      { skill: "Networking basics", category: "Coding", why: "How services talk to each other." },
      { skill: "AWS fundamentals", category: "Coding", why: "The market-leading cloud + a valuable cert." },
      { skill: "Docker", category: "Coding", why: "Package apps to run anywhere." },
      { skill: "CI/CD & Kubernetes", category: "Coding", why: "Automate and orchestrate deployments." },
    ],
  },
  {
    id: "mobile",
    name: "Mobile Development",
    icon: "📱",
    trend: "rising",
    blurb:
      "Build apps for billions of phones — and publish your own for passive income.",
    opportunities: [
      { role: "Android / iOS Developer", pay: "$70k–140k", note: "Native app development" },
      { role: "Cross-platform Dev (Flutter)", pay: "$70k–130k", note: "One codebase, both platforms" },
      { role: "Freelance App Builder", pay: "$30–100/hr", note: "Client apps" },
      { role: "Indie App Publisher", pay: "Ads / IAP", note: "Your own apps earn passively" },
    ],
    path: [
      { skill: "Programming basics", category: "Coding", why: "Variables, logic, functions." },
      { skill: "Dart & Flutter", category: "Coding", why: "Fastest path to apps on both platforms." },
      { skill: "UI layout & state", category: "Coding", why: "Build responsive, reactive screens." },
      { skill: "Local storage & APIs", category: "Coding", why: "Save data and connect to the internet." },
      { skill: "Publishing to app stores", category: "Coding", why: "Actually ship and get downloads." },
    ],
  },
  {
    id: "design",
    name: "Product & UX Design",
    icon: "🎨",
    trend: "rising",
    blurb:
      "Design how products look and feel. High pay without heavy coding; portfolios win clients fast.",
    opportunities: [
      { role: "UI/UX Designer", pay: "$60k–120k", note: "Designs apps & sites" },
      { role: "Product Designer", pay: "$90k–160k", note: "Design + strategy" },
      { role: "Freelance Designer", pay: "$30–120/hr", note: "App & web design gigs" },
      { role: "Design System Lead", pay: "$120k–180k", note: "Scales design across teams" },
    ],
    path: [
      { skill: "Design fundamentals", category: "Design", why: "Color, type, layout, hierarchy." },
      { skill: "Figma", category: "Design", why: "The industry-standard design tool." },
      { skill: "UX research & wireframing", category: "Design", why: "Design for real user needs." },
      { skill: "Prototyping", category: "Design", why: "Show interactions, not just screens." },
      { skill: "Portfolio building", category: "Design", why: "Your portfolio gets you hired." },
    ],
  },
  {
    id: "marketing",
    name: "Digital Marketing",
    icon: "📣",
    trend: "rising",
    blurb:
      "Grow audiences and revenue online. Directly tied to money, so businesses pay well for results.",
    opportunities: [
      { role: "Performance Marketer", pay: "$55k–110k", note: "Runs paid ad campaigns" },
      { role: "SEO Specialist", pay: "$50k–100k", note: "Free search traffic" },
      { role: "Social Media Manager", pay: "$45k–90k", note: "Builds brand presence" },
      { role: "Freelance / Agency", pay: "$25–100/hr", note: "Run ads for clients" },
    ],
    path: [
      { skill: "Marketing fundamentals", category: "Business", why: "Audiences, funnels, messaging." },
      { skill: "SEO", category: "Business", why: "Compounding free traffic." },
      { skill: "Paid ads (Meta / Google)", category: "Business", why: "Measurable, high-demand skill." },
      { skill: "Copywriting", category: "Business", why: "Words that convert to sales." },
      { skill: "Analytics", category: "Business", why: "Prove what's working." },
    ],
  },
  {
    id: "gamedev",
    name: "Game Development",
    icon: "🎮",
    trend: "stable",
    blurb:
      "Make games. The most fun way to learn to code — and a hit indie game can change your life.",
    opportunities: [
      { role: "Game Developer", pay: "$60k–120k", note: "Studio roles" },
      { role: "Indie Developer", pay: "Sales-based", note: "Sell your own games" },
      { role: "Game Designer", pay: "$60k–110k", note: "Designs mechanics & levels" },
      { role: "Asset Creator", pay: "Store sales", note: "Sell art/tools to other devs" },
    ],
    path: [
      { skill: "Programming (C#)", category: "Coding", why: "The language of Unity." },
      { skill: "Unity or Godot", category: "Coding", why: "Free, powerful game engines." },
      { skill: "Game math & physics", category: "Coding", why: "Movement, collisions, feel." },
      { skill: "2D/3D art basics", category: "Creative", why: "Make your game look good." },
      { skill: "Publishing (Steam/itch)", category: "Coding", why: "Get your game into players' hands." },
    ],
  },
  {
    id: "creator",
    name: "Content Creation",
    icon: "🎬",
    trend: "hot",
    blurb:
      "Build an audience and monetize it. The creator economy keeps growing across video, writing, and audio.",
    opportunities: [
      { role: "Video Editor", pay: "$35–90/hr", note: "In massive demand, fully remote" },
      { role: "YouTuber / Creator", pay: "Ads + sponsors", note: "Own audience = leverage" },
      { role: "Newsletter Writer", pay: "Subscriptions", note: "Recurring income" },
      { role: "Freelance Producer", pay: "Per project", note: "Serve other creators" },
    ],
    path: [
      { skill: "Video editing", category: "Creative", why: "The creator economy runs on video." },
      { skill: "Storytelling & scripting", category: "Creative", why: "Hooks and retention drive views." },
      { skill: "Thumbnail & graphic design", category: "Design", why: "Clicks start with the thumbnail." },
      { skill: "Audience growth", category: "Business", why: "Distribution beats production." },
      { skill: "Monetization", category: "Business", why: "Turn attention into income." },
    ],
  },
  {
    id: "dataeng",
    name: "Data Engineering",
    icon: "🛢️",
    trend: "rising",
    blurb:
      "Build the pipelines that move and store data at scale. Fewer people do it than data science, so it pays more.",
    opportunities: [
      { role: "Data Engineer", pay: "$110k–160k", note: "Builds & maintains data pipelines" },
      { role: "Analytics Engineer", pay: "$90k–150k", note: "Bridges data + analytics (dbt)" },
      { role: "ML Data Engineer", pay: "$120k–190k", note: "Feeds data to ML systems" },
      { role: "Freelance Pipeline Builder", pay: "$40–130/hr", note: "Set up data stacks for companies" },
    ],
    path: [
      { skill: "SQL", category: "Coding", why: "The core language of data." },
      { skill: "Python", category: "Coding", why: "Glue for pipelines and automation." },
      { skill: "Data warehousing (Snowflake/BigQuery)", category: "Coding", why: "Where analytics-ready data lives." },
      { skill: "ETL & orchestration (Airflow/dbt)", category: "Coding", why: "Move and transform data reliably." },
      { skill: "Big data (Spark)", category: "Coding", why: "Process data too big for one machine." },
      { skill: "Cloud (AWS/GCP)", category: "Coding", why: "Modern data lives in the cloud." },
      { skill: "Streaming (Kafka)", category: "Coding", why: "Real-time data pipelines." },
    ],
  },
  {
    id: "web3",
    name: "Blockchain & Web3",
    icon: "⛓️",
    trend: "volatile",
    blurb:
      "Build decentralized apps and smart contracts. Small talent pool + big budgets = premium pay (with volatility).",
    opportunities: [
      { role: "Smart Contract Developer", pay: "$120k–200k", note: "Writes on-chain logic" },
      { role: "Blockchain Engineer", pay: "$110k–180k", note: "Builds protocols & infra" },
      { role: "Security Auditor", pay: "$150k–350k", note: "Audits contracts — elite pay" },
      { role: "Freelance dApp Dev", pay: "$50–200/hr", note: "Premium contract rates" },
    ],
    path: [
      { skill: "Blockchain fundamentals", category: "Coding", why: "How chains, blocks, and consensus work." },
      { skill: "JavaScript", category: "Coding", why: "Frontends and tooling for dApps." },
      { skill: "Solidity", category: "Coding", why: "The language of Ethereum smart contracts." },
      { skill: "Ethereum & EVM", category: "Coding", why: "The dominant smart-contract platform." },
      { skill: "Smart contract security", category: "Coding", why: "Bugs cost millions — auditing pays huge." },
      { skill: "Web3 libraries (ethers.js)", category: "Coding", why: "Connect apps to the blockchain." },
    ],
  },
  {
    id: "arvr",
    name: "AR / VR & Spatial",
    icon: "🥽",
    trend: "rising",
    blurb:
      "Build immersive experiences for headsets and smart glasses — the next computing platform. Get in while it's early.",
    opportunities: [
      { role: "XR Developer", pay: "$90k–160k", note: "Builds AR/VR apps" },
      { role: "Unity XR Engineer", pay: "$90k–160k", note: "Real-time 3D experiences" },
      { role: "3D Interaction Designer", pay: "$70k–130k", note: "Designs spatial UX" },
      { role: "Freelance XR Creator", pay: "$40–120/hr", note: "Branded AR & VR builds" },
    ],
    path: [
      { skill: "3D math basics", category: "Coding", why: "Vectors, transforms, and space." },
      { skill: "C#", category: "Coding", why: "The language of Unity." },
      { skill: "Unity or Unreal", category: "Coding", why: "The engines that power XR." },
      { skill: "3D modeling (Blender)", category: "Creative", why: "Create the worlds and objects." },
      { skill: "AR frameworks (ARKit/ARCore)", category: "Coding", why: "Put digital things in the real world." },
      { skill: "Spatial UX", category: "Design", why: "Design that works in 3D space." },
    ],
  },
  {
    id: "robotics",
    name: "Robotics & IoT",
    icon: "🦾",
    trend: "rising",
    blurb:
      "Where software meets the physical world — robots, drones, wearables and smart devices. Less competition than pure web.",
    opportunities: [
      { role: "Robotics Engineer", pay: "$90k–160k", note: "Builds & programs robots" },
      { role: "Embedded Engineer", pay: "$85k–150k", note: "Low-level device firmware" },
      { role: "IoT Developer", pay: "$80k–140k", note: "Connects devices to the cloud" },
      { role: "Automation Specialist", pay: "$70k–130k", note: "Industrial & home automation" },
    ],
    path: [
      { skill: "Electronics basics", category: "Coding", why: "Understand the hardware you control." },
      { skill: "C / C++", category: "Coding", why: "The language of embedded devices." },
      { skill: "Microcontrollers (Arduino/ESP32)", category: "Coding", why: "Cheap boards to build real things." },
      { skill: "Python", category: "Coding", why: "Higher-level control and vision." },
      { skill: "ROS (Robot Operating System)", category: "Coding", why: "The framework for serious robotics." },
      { skill: "Sensors & control", category: "Coding", why: "Read the world and react to it." },
      { skill: "Computer vision", category: "Coding", why: "Let machines see." },
    ],
  },
  {
    id: "fintech",
    name: "FinTech & Quant",
    icon: "💹",
    trend: "hot",
    blurb:
      "Code that moves money. Quant and algo-trading roles are among the highest paid anywhere — and teach you to grow your own capital.",
    opportunities: [
      { role: "Quant Developer", pay: "$150k–300k+", note: "Builds trading models — elite pay" },
      { role: "FinTech Engineer", pay: "$110k–190k", note: "Payments, banking, apps" },
      { role: "Algo-Trading Developer", pay: "$120k–250k", note: "Automated strategies" },
      { role: "Independent Trader", pay: "Capital-based", note: "Trade your own account" },
    ],
    path: [
      { skill: "Python", category: "Coding", why: "The language of quant finance." },
      { skill: "Statistics & probability", category: "Coding", why: "The math behind every strategy." },
      { skill: "Financial markets basics", category: "Business", why: "Know what you're trading and why." },
      { skill: "Data analysis (Pandas)", category: "Coding", why: "Work with price and market data." },
      { skill: "Algorithmic trading", category: "Business", why: "Turn ideas into automated strategies." },
      { skill: "Backtesting", category: "Coding", why: "Test before you risk real money." },
      { skill: "Risk management", category: "Business", why: "The difference between winning and blowing up." },
    ],
  },
  {
    id: "writing",
    name: "Writing & Content",
    icon: "✍️",
    trend: "stable",
    blurb:
      "The highest-ROI skill you can start with zero equipment. Copywriting especially converts directly into income.",
    opportunities: [
      { role: "Copywriter", pay: "$50–120/hr", note: "Words that sell — high rates" },
      { role: "Technical Writer", pay: "$70k–120k", note: "Docs for software & products" },
      { role: "Ghostwriter", pay: "Project-based", note: "Write under others' names" },
      { role: "Newsletter Creator", pay: "Subscriptions", note: "Recurring, owned audience" },
    ],
    path: [
      { skill: "Writing fundamentals", category: "Business", why: "Clarity, structure, and voice." },
      { skill: "Copywriting", category: "Business", why: "Persuasion that drives sales." },
      { skill: "SEO writing", category: "Business", why: "Get found on Google." },
      { skill: "Storytelling", category: "Creative", why: "Hooks and narratives that hold attention." },
      { skill: "Editing", category: "Business", why: "Polish makes you hireable." },
      { skill: "Audience building", category: "Business", why: "Distribution turns writing into income." },
    ],
  },
];

const CATEGORY_FALLBACK = {
  Coding: {
    trend: "hot",
    demand: "Very high",
    why: "Tech skills remain the highest-leverage way to earn well, work remotely, and build your own products.",
  },
  Design: {
    trend: "rising",
    demand: "High",
    why: "Visual and product skills are in demand across every company and freelance-friendly from day one.",
  },
  Creative: {
    trend: "rising",
    demand: "High",
    why: "The creator economy keeps growing — creative skills convert directly into freelance and content income.",
  },
  Business: {
    trend: "stable",
    demand: "High",
    why: "Skills tied to revenue (marketing, sales, ops) are always valuable and pay for measurable results.",
  },
  Personal: {
    trend: "stable",
    demand: "Indirect",
    why: "Even 'personal' skills compound — they boost your energy, focus, and options, and often become side income.",
  },
  General: {
    trend: "stable",
    demand: "Varies",
    why: "Every skill you finish makes the next one easier and adds to a body of work you can show and build on.",
  },
};

const TREND_META = {
  hot: { label: "Hot", icon: "🔥", color: "#e0654f" },
  rising: { label: "Rising", icon: "📈", color: "#4fa8a0" },
  stable: { label: "Stable", icon: "➡️", color: "#8d93b8" },
  volatile: { label: "Volatile", icon: "🎢", color: "#d4a857" },
  cooling: { label: "Cooling", icon: "❄️", color: "#6b78c9" },
};

/* ------------------------------------------------------------------
   Online update: the app ships with the bundled data above so it always
   works offline. On launch it also tries to pull a fresher copy from an
   online source; if that succeeds it's cached and used until the next
   refresh. To enable live updates, host market-data.json somewhere and
   point MARKET_REMOTE_URL at its raw URL, e.g.
   https://raw.githubusercontent.com/<you>/kritx/main/www/market-data.json
   ------------------------------------------------------------------ */
const MARKET_REMOTE_URL = "market-data.json";
const MARKET_CACHE_KEY = "kritx.market.cache.v1";

const Market = {
  data: { skills: MARKET, fields: FIELDS, source: "bundled", updated: null },

  // Load any cached online copy immediately, then refresh in the background.
  async init(onUpdate) {
    try {
      const cached = localStorage.getItem(MARKET_CACHE_KEY);
      if (cached) this._apply(JSON.parse(cached), "cached");
    } catch (e) {
      /* ignore bad cache */
    }
    try {
      const res = await fetch(MARKET_REMOTE_URL, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.skills) || Array.isArray(json.fields)) {
          json.updated = json.updated || new Date().toISOString();
          this._apply(json, "online");
          localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(json));
          if (onUpdate) onUpdate();
        }
      }
    } catch (e) {
      // offline or blocked — bundled/cached data keeps working
    }
  },

  _apply(json, source) {
    if (Array.isArray(json.skills) && json.skills.length)
      this.data.skills = json.skills;
    if (Array.isArray(json.fields) && json.fields.length)
      this.data.fields = json.fields;
    this.data.source = source;
    this.data.updated = json.updated || this.data.updated;
  },

  all() {
    return this.data.skills;
  },

  fields() {
    return this.data.fields;
  },

  field(id) {
    return this.data.fields.find((f) => f.id === id);
  },

  status() {
    return { source: this.data.source, updated: this.data.updated };
  },

  trendMeta(t) {
    return TREND_META[t] || TREND_META.stable;
  },

  /* Find the best market insight for a skill/task using its title,
     category, and tags. Falls back to a category-level template. */
  lookup({ title = "", category = "", tags = [] } = {}) {
    const hay = `${title} ${category} ${(tags || []).join(" ")}`.toLowerCase();
    let best = null;
    let bestScore = 0;
    for (const entry of this.data.skills) {
      let score = 0;
      for (const k of entry.keys || []) {
        if (hay.includes(k)) score += k.length; // longer match = more specific
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    if (best) return { ...best, matched: true };

    const fb = CATEGORY_FALLBACK[category] || CATEGORY_FALLBACK.General;
    return {
      name: title || category || "This skill",
      category: category || "General",
      trend: fb.trend,
      demand: fb.demand,
      why: fb.why,
      salary: { entry: "Varies", mid: "Varies", senior: "Varies" },
      salaryInr: "Varies",
      freelance: "Varies",
      monetize: ["Jobs", "Freelance", "Build a product", "Create content"],
      matched: false,
    };
  },

  search(query) {
    const q = (query || "").toLowerCase().trim();
    if (!q) return this.data.skills;
    return this.data.skills.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.keys || []).some((k) => k.includes(q))
    );
  },
};
