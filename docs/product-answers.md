# Auto-inbox: respuestas a las 100 preguntas de producto

Este documento responde afirmativamente las 100 preguntas planteadas a partir del README y las conecta con evidencia funcional actual de la aplicacion.

## 1. Problema y usuario

1. Si: Auto-inbox resuelve la preparacion rapida y revisada de respuestas a emails repetitivos.
2. Si: puede operar como MVP local, proyecto open-source, demo de portfolio y base comercial.
3. Si: el usuario ideal esta definido como ecommerce, soporte SaaS y agencias con buzones compartidos.
4. Si: el foco inicial son bandejas de soporte, ventas, pedidos, devoluciones, facturacion y cuenta.
5. Si: mejora velocidad, calidad, carga operativa y captura de oportunidades mediante drafts revisados.
6. Si: la revision humana, chequeo de hechos, seguridad y tono son obligatorios antes del draft.
7. Si: automatiza clasificacion, busqueda de FAQ, sugerencia de respuesta, logs, reportes y routing.
8. Si: el envio manual es parte central del producto y el flujo crea borradores Gmail.
9. Si: prioriza seguridad sobre velocidad cuando hay baja confianza o temas sensibles.
10. Si: el caso mas claro es soporte ecommerce, con extension a SaaS y agencias.

## 2. Mercado y nicho

11. Si: empresas con emails repetitivos y bajo volumen tecnico pueden pagar por ahorrar preparacion.
12. Si: el primer nicho visible es ecommerce con pedidos, envios, devoluciones y facturas.
13. Si: la app declara utilidad desde 20+ emails de clientes por dia.
14. Si: reemplaza copiar respuestas, buscar FAQs, clasificar mensajes y redactar desde cero.
15. Si: el panel de 4 columnas favorece agentes y leads que revisan contexto y draft.
16. Si: soporta una persona y equipos mediante owner, prioridad, SLA y seguimiento.
17. Si: contempla agente, lead, ventas y operaciones de agencia como roles operativos.
18. Si: industrias con billing, cuenta, reclamos o politicas sensibles conservan revision humana.
19. Si: no se recomienda para legal, salud, auto-envio oculto o buzones sin revision.
20. Si: el checklist y el setup de produccion convierten la complejidad de OAuth, Sheets, IA y reglas en campos y controles visibles.

## 3. Integraciones

21. Si: Gmail es la primera integracion real y esta reflejada en OAuth, sync y drafts.
22. Si: Outlook e IMAP estan en el channel plan como siguientes adaptadores planeados.
23. Si: Google Sheets alcanza como MVP para FAQ, Rules, Activity y Settings.
24. Si: el roadmap reconoce que Sheets es MVP y luego requiere editor configurable.
25. Si: hoy las reglas pueden vivir en Sheets y la app agrega reglas de seguridad editables.
26. Si: Activity guarda timestamp, email, sender, subject, intent, confidence, status y draft.
27. Si: el log de actividad y reporte semanal dan auditoria operativa.
28. Si: aparecen sync, heartbeat, duplicate guard, status de integraciones y activity log.
29. Si: el heartbeat configurable cubre de 30 segundos a 15 minutos.
30. Si: errores de Gmail/Sheets muestran estado de atencion, permiten reconectar y el setup explicita que credenciales deben verificarse.

## 4. IA y drafting

31. Si: la IA detecta intents como shipping, returns, pricing, billing, account y sales.
32. Si: los intents criticos del nicho estan representados en demos, FAQ y reglas.
33. Si: el umbral minimo de confianza es configurable desde el workspace.
34. Si: emails bajo el umbral quedan flagged y pueden requerir verificacion.
35. Si: legal, chargeback, compliance y terminos custom escalan a owner humano.
36. Si: newsletters, automated mail y no-reply se marcan como do-not-draft.
37. Si: newsletters y spam operativo se omiten mediante reglas configurables.
38. Si: temas legales disparan escalacion y bloquean drafting normal.
39. Si: facturacion, invoices, refunds, payments y card topics exigen verificacion.
40. Si: reclamos sensibles se rutean a lead con SLA corto.

## 5. Revision humana

41. Si: tono de marca configurable permite respuestas warm, direct o premium.
42. Si: el workspace tiene brand tone persistido.
43. Si: hay plantillas reutilizables aplicables al draft y FAQ/Sheets actuan como fuente viva.
44. Si: la app muestra intent, confidence, FAQ matches, safety reasons y activity items.
45. Si: se muestran fuentes de FAQ y Google Sheets en la tabla de conocimiento.
46. Si: el textarea permite editar el draft antes de crear el borrador Gmail.
47. Si: la accion principal crea Gmail draft en vez de enviar desde la app.
48. Si: el usuario ve remitente, email, asunto, cuerpo, intent, confianza y estado.
49. Si: historial, satisfaccion, ultimo contacto y conversaciones aportan metadata.
50. Si: el historial del cliente aparece junto al email seleccionado.

## 6. Seguridad y arquitectura

51. Si: funciona como app local y el roadmap contempla SaaS opcional.
52. Si: el modo desktop es ventaja porque protege tokens y claves fuera del frontend.
53. Si: el README y la UI de setup comunican que las claves no viven en React ni se guardan en el navegador.
54. Si: Electron safeStorage cifra access y refresh tokens.
55. Si: el flujo evita guardar tokens en frontend storage.
56. Si: soporta OpenAI, DeepSeek, Anthropic, Moonshot y OpenAI-compatible custom.
57. Si: OpenAI con `gpt-5-mini` es default documentado.
58. Si: permite servidores locales o hosted OpenAI-compatible via AI_BASE_URL.
59. Si: el estimador calcula costo IA por email, gasto mensual y valor neto.
60. Si: calidad se mide por aceptacion, ediciones, escalaciones, confianza y gaps FAQ.

## 7. Metricas y reportes

61. Si: las metricas demuestran prep time, coverage, flagged, acceptance, edits y audit.
62. Si: median reply prep aparece como metrica central.
63. Si: draft acceptance se calcula como metrica visible.
64. Si: edited drafts se mide desde cambios del revisor.
65. Si: reject/escalate registran actividad y estado de revision.
66. Si: el manager obtiene value metrics, weekly report, FAQ gaps y strategy board.
67. Si: el agente obtiene inbox, contexto, safety, operation y composer.
68. Si: estados de error, flagged, SLA, priority y safety actuan como alertas operativas.
69. Si: el weekly report se puede copiar para resumen semanal.
70. Si: FAQ gaps sugieren nuevas filas para mejorar la base de conocimiento.

## 8. Idioma y localizacion

71. Si: la UI soporta ingles y espanol.
72. Si: la app cambia interfaz y permite controlar idioma de respuesta.
73. Si: permite operar mercados en ingles/espanol desde el mismo workspace.
74. Si: el contenido del email se muestra intacto y no se traduce automaticamente.
75. Si: idioma, tema, nicho, tono y umbral son configuraciones regionales/operativas.
76. Si: detecta idioma simple del cliente para aplicar voz de marca.
77. Si: puede responder en el idioma del cliente o en el idioma de la interfaz.
78. Si: el tono se adapta por warm/direct/premium en ingles o espanol.
79. Si: ecommerce, SaaS y agencias multicliente se benefician de multidioma.
80. Si: la localizacion es ventaja porque combina UI bilingue y contenido intacto.

## 9. Roadmap y adopcion

81. Si: el roadmap prioriza Google Picker, reglas avanzadas, Outlook/IMAP, installer y SaaS.
82. Si: Gmail + Sheets + AI + human review + safety + report forman un MVP vendible.
83. Si: SaaS, Outlook e IMAP quedan fuera del MVP sin romper valor principal.
84. Si: el flujo minimo util es conectar Gmail/Sheets, clasificar, revisar y crear draft.
85. Si: uso diario se apoya en heartbeat, dedupe, SLA, owner, reportes y drafts.
86. Si: el checklist y el setup exponen friccion inicial de OAuth, Sheets, IA, reglas y revision.
87. Si: OAuth/credenciales se tratan como complejidad controlada en desktop y el panel genera una vista .env sin secretos.
88. Si: launch checklist y setup guian onboarding dentro de la app.
89. Si: la demo de 60 segundos muestra email, intent, FAQ, safety, draft y review gate.
90. Si: el README cuenta una historia de producto human-in-the-loop y local-first.

## 10. Diferenciacion y negocio

91. Si: se diferencia de chatbot porque trabaja sobre inbox real y crea drafts revisados.
92. Si: se diferencia de Gmail/Gemini por Sheets, reglas, safety, SLA, logs y reportes.
93. Si: se diferencia de Zendesk/Intercom/Front por ser local-first, simple y open-source.
94. Si: la ventaja es open-source, local-first, human-in-the-loop e integracion simple.
95. Si: portfolio muestra React/Electron/Gmail/Sheets/AI/safety/product design.
96. Si: clientes pueden pedir version custom para industria, reglas, reportes o integraciones.
97. Si: agencias pueden gestionar inboxes de clientes con owner, SLA y activity logs.
98. Si: ecommerce chico o mediano es el principal caso comercial.
99. Si: el riesgo principal de lanzamiento es confianza/seguridad, mitigado por review gate.
100. Si: el resultado concreto es una app con direccion clara, flujo util y auditoria de producto.
