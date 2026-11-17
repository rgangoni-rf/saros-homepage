# Guia de tradução do site Saros (EN → ES-ES e FR-CA)

Saros é uma plataforma de **learning operations** para equipes de L&D (aprendizagem e desenvolvimento) de empresas.
Público: líderes de L&D, RH, finanças. Tom: claro, direto, profissional, sem jargão vazio nem exagero de marketing.
Traduza para soar **escrito por um falante nativo**, não como tradução literal. Adapte frases; mantenha o sentido e os fatos.

## Formato (o mais importante)
- Entrada: um JSON `{ "texto em inglês": "texto em inglês" }`. Saída: **o mesmo JSON, com as MESMAS chaves, e o valor traduzido**.
- Não mude, remova nem reordene chaves. Todas as chaves precisam aparecer na saída.
- Chaves que começam com `js:`: o texto aparece dentro de widgets (perguntas, resultados). O **valor não leva o prefixo `js:`**.
  Mantenha placeholders como `%s`, `{0}`, `{name}`, `${...}` exatamente como estão.
- **HTML**: se a chave tem tags (`<a href="...">`, `<b>`, `<span class="...">`, `<br>`, `<em>`, `<svg/>`), o valor deve ter **as mesmas tags com os mesmos atributos**
  (`href`, `class`, `id`, `data-*` etc. não se traduzem). Só o texto entre as tags se traduz; o texto pode mudar de ordem se a gramática pedir,
  mas cada tag de abertura e de fechamento precisa continuar presente.
- Mantenha as entidades como estão (`&amp;`, `&nbsp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`). Pode usar letras acentuadas e aspas tipográficas normalmente (o HTML é UTF-8).
- `<svg/>` é um ícone: mantenha-o na posição lógica.
- Se um texto for só nome próprio, sigla ou valor que não se traduz (ex.: `FLUX`, `Saros`, `SSO`), devolva igual.
- Não traduza nem toque em marcadores internos entre colchetes (`[confirmar: ...]`, `[definir: ...]`): devolva idênticos.
- Respeite o tamanho: rótulos de botão, menu e abas devem ficar curtos (aproximadamente o tamanho do original).

## Nunca traduzir
Saros · FLUX · ReFrame Learning · Intake Express · LMS · LXP · HRIS · SSO · SAML · SCIM · KPI · ROI · L&D · AI quando for sigla de produto (veja glossário) ·
nomes de ferramentas de terceiros (Slack, Teams, Workday, SAP, HubSpot, Salesforce, Zoom etc.) · fontes e relatórios citados (ATD, TalentLMS, Training Magazine…).

## Glossário comum (use sempre os mesmos termos)
| Inglês | ES-ES | FR-CA |
|---|---|---|
| learning operations | operaciones de aprendizaje | opérations d’apprentissage |
| L&D | L&D | L&D |
| training (corporativo) | formación | formation |
| training request | solicitud de formación | demande de formation |
| training intake | recepción de solicitudes de formación | réception des demandes de formation |
| intake form | formulario de solicitud | formulaire de demande |
| project pipeline | pipeline de proyectos | pipeline de projets |
| learner | persona participante / participante | apprenant, apprenante (usar « personnes apprenantes » ou « apprenants » no plural) |
| role-based learning paths | itinerarios de aprendizaje por rol | parcours d’apprentissage par rôle |
| stakeholders | partes interesadas | parties prenantes |
| dashboard | panel | tableau de bord |
| onboarding | incorporación | intégration |
| backlog | backlog | backlog |
| workflow | flujo de trabajo | flux de travail |
| content production | producción de contenidos | production de contenu |
| analytics | analítica | analytique |
| pricing / plans | precios / planes | tarifs / forfaits |
| book a demo | reserva una demo | réservez une démo |
| work email | correo electrónico de trabajo | courriel professionnel |
| email (genérico) | correo electrónico / correo | courriel |
| sign in / log in | iniciar sesión | ouvrir une session |
| Health Check (ferramenta) | Health Check (manter) + descritor traduzido | Health Check (manter) + descritor traduzido |
| Free tools | Herramientas gratuitas | Outils gratuits |
| Coming soon | Próximamente | Bientôt |

## ES-ES (espanhol da Espanha)
- Trate o leitor por **tú** (imperativo de tú: «reserva», «descubre», «prueba»). Plural informal, quando preciso: «vosotros». Evite «usted/ustedes».
- Vocabulário ibérico: ordenador (não computadora), móvil (não celular), gestionar, vale, equipo; evite latino-americanismos.
- Linguagem inclusiva sem formas com @ ou x: prefira coletivos e perífrases («el equipo de L&D», «las personas que lideran…»).
- Números: separador decimal vírgula; milhares com ponto a partir de 5 dígitos (1760, 12.500); espaço antes de %: «12 %». Moeda: o site usa dólares; mantenha o valor e o símbolo (ex.: «310 000 $» → pode ficar «310 k$»), sem converter.
- Aspas: « » ou “ ” (consistente). Título em caixa de frase (só a primeira palavra e nomes próprios em maiúscula).

## FR-CA (francês canadense, Québec)
- Trate o leitor por **vous**. Use «courriel» (não «e-mail/mail»), «fin de semaine», «clavardage», «logiciel», «formation», «téléverser», «infonuagique» quando surgir.
- Prefira os termos canadenses oficiais e evite anglicismos óbvios, **mas** mantenha os termos de produto da lista «Nunca traduzir».
- Espaço fino/normal antes de « : », « ; », « ? », « ! » e « % » (use espaço insécable `&nbsp;` ou o caractere U+00A0), aspas « ».
- Números: espaço como separador de milhares (1 760 / 12 500), vírgula decimal, **símbolo $ depois do número com espaço**: «1 000 $», «12,5 %».
- Escrita inclusiva moderada: use formas épicenes e «personnes» quando soar natural; evite ponto médio.
- Títulos em caixa de frase.

## Qualidade
- Frases curtas; verbos de ação nos botões («Reserva una demo», «Réservez une démo»).
- Não omita nem acrescente informação; números, prazos e nomes iguais.
- Mantenha a mesma tradução para o mesmo termo em todo o arquivo e siga o glossário.
- Em dúvida entre literal e natural, escolha o natural, desde que o sentido fique idêntico.

## Textos dentro de código (relatórios das ferramentas)
- `⟦0⟧`, `⟦1⟧`… são expressões de código: mantenha cada marcador **exatamente igual**, uma vez, na posição que a gramática pedir.
- A sequência `\n` (barra + n) é uma quebra de linha de e-mail: mantenha-a como está.
- Mantenha `$`, `%`, números e unidades na ordem lógica do idioma, sem alterar o marcador (ex.: `$⟦3⟧/hour` → ES `⟦3⟧ $/hora`; FR-CA `⟦3⟧ $/heure`).
