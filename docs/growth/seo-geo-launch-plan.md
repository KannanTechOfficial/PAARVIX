# SEO, GEO and Launch Plan

How people will find Paarvix, through search, AI answers and local communities. Costs ₹0 unless noted.

**Rule:** only promote what works today. Paarvix has no dashboard builder yet, so a big launch now would waste the one chance at a first impression.

## When to launch

| Moment | Ready when | Do |
|---|---|---|
| Soft launch | Stage 1 passes final review | Make the repo public, tell a few friends, and collect feedback |
| Real launch | Excel to first dashboard works in 2 minutes (stage 2) | Show HN, r/selfhosted, Product Hunt |
| Sector launch | Education pack works with one real college | Case study, college outreach |

## Search (SEO)

Pick one main phrase per page, and answer it in the first lines.

| Audience | Search phrases to target |
|---|---|
| Colleges | college attendance dashboard, NAAC data dashboard, student result analysis software |
| Small business | Excel to dashboard free, sales dashboard from Excel, Tally dashboard |
| Technical | open source Metabase alternative, self-hosted dashboard, open source BI for small teams |
| India | dashboard software India, Tamil dashboard software, lakh crore number format dashboard |

These are starting ideas with no volume data. Check them in Google Search Console or Keyword Planner before writing.

**Repo basics, in place when public:** clear description, topics, README, screenshot, license, and answer-style FAQ.

**Next, on `paarvix.com` or `kannantech.com`:**

1. A landing page for each audience.
2. One useful guide a week, such as "How to find attendance defaulters from an Excel sheet".
3. `SoftwareApplication` and `FAQPage` structured data.
4. A free live demo with made-up data, the strongest asset of all.

Guides should solve the problem in Excel too. That earns links and trust.

## AI answers (GEO)

ChatGPT, Claude, Gemini and Perplexity answer from sources they trust.

- **Be easy to quote:** short factual definitions, as in the README's first lines and FAQ.
- **Be consistent:** use the same one-line description everywhere.
- **Keep `llms.txt` current.** It's a young convention, so treat it as cheap, not magic.
- **Be mentioned elsewhere:** awesome-selfhosted, alternativeto.net, comparison posts, and Wikipedia only when truly notable. Independent mentions matter most.
- **Publish real numbers:** install size, memory use and import speed from real tests.
- **Be honest about limits.** It's also what makes a source trustworthy.

**One-line description, use everywhere:**

> Paarvix is an open-source, self-hosted dashboard platform that turns Excel, Google Sheets and databases into clear insight, built for organisations without a data team.

## Local reach (Tamil Nadu and India)

This is the real advantage, since big tools don't compete here.

- **Pilot:** one free pilot in a college you know, with permission and made-up or approved data. Then write a case study.
- **Google Business Profile** for KannanTech, for "near me" searches.
- **Tamil content:** YouTube demos and Shorts in Tamil. Almost nobody explains dashboards in Tamil.
- **Tamil keywords:** write the Tamil pages properly, and have a native speaker check them.
- **Events:** FOSS United meetups, college tech fests, AICTE and NAAC coordinator groups.
- **Student ambassadors:** one in each college, with a certificate and credit.

## Developer reach

- **GitHub topics:** dashboard, data-visualization, analytics, angular, nestjs, self-hosted, open-source, business-intelligence, excel, india, tamil.
- **Lists:** awesome-selfhosted, awesome-angular, awesome-nestjs, once they accept it.
- **Build in public:** Dev.to or Hashnode posts on real lessons, such as containing malicious Excel files.
- **Good first issues:** label 10 small ones before launch.
- **Discussions:** turn on GitHub Discussions before launch.

## Measure

Track weekly: GitHub stars, Docker pulls, demo visits, installs, first paid enquiry. Telemetry stays opt-in, so use public numbers.

The first target is one real organisation using it weekly. That is worth more than a thousand stars.

## Before going public

- [x] History audited: no student records or real ID numbers found.
- [x] Default secrets removed.
- [ ] Decide whether `CLAUDE.md` stays public, because it contains pricing and strategy.
- [ ] Decide whether the old "FXEC" names in history are acceptable.
- [ ] Finish the import re-review and the final review.
- [ ] Rebuild the screenshot once the dashboard builder exists.
- [ ] Set up the CLA Assistant named in `CONTRIBUTING.md`.
