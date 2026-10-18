# IRON AI — site

Site estático da IRON AI (spin-off de IA do Grupo IRON). HTML/CSS/JS sem build; GSAP + ScrollTrigger e Lenis vendorizados em `vendor/`, fontes self-hosted em `fonts/` (OFL).

- Deploy: Vercel (projeto `iron-ai`, time Iron Security), saída estática da raiz.
- Cabeçalhos de segurança em `vercel.json`: CSP restrita (`'self'` apenas), HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer/Permissions-Policy, COOP/CORP e `X-Robots-Tag: noindex` enquanto o site estiver em construção.
- Em construção (loop de design): home P1 (topo) fechado, P2 (pilares, esteira, zoom, casos) em correção; P3 e páginas internas pendentes.
