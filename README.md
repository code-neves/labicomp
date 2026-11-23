# Labicomp Neo

Jogo de labirinto lógico com salas em tempo real pelo Supabase Realtime. O anfitrião cria a sala e compartilha um código curto; estudantes entram digitando esse código. Não há lista pública de salas. A animação de fundo Koi e a identidade visual Koi Plugged continuam incluídas.

## Configurar o Supabase

1. Crie um projeto Supabase.
2. Em Project Settings → API, copie a Project URL e a chave publishable (ou a chave `anon` legada). Nunca coloque uma `secret` ou `service_role` key no site.
3. Preencha `url` e `publishableKey` em `assets/js/supabase-config.js`.
4. Publique a pasta em HTTPS (por exemplo, GitHub Pages) e abra `index.html`. A biblioteca Supabase é carregada pelo CDN.

As salas usam canais Realtime públicos identificados pelo código de seis caracteres. O navegador do anfitrião precisa permanecer conectado para manter a sala disponível. Quem tiver o código pode entrar e as alterações nos programas e execuções são retransmitidas aos participantes. O código identifica a sala, mas não autentica participantes; não use para dados privados.

Sem credenciais Supabase, os modos locais existentes continuam disponíveis, mas criar ou entrar numa sala em tempo real fica desativado.

## Arquivos

- `index.html` — estrutura do jogo e carregamento da animação Koi
- `assets/css/theme.css` — cores e estilos base
- `assets/css/game.css` — interface, tema escuro da entrada e responsividade
- `assets/js/game.js` — geração, comandos, salas e sincronização das execuções
- `assets/js/koi.js` — animação de fundo
- `assets/js/room-client.js` — conexão Supabase Realtime
- `assets/js/supabase-config.js` — URL e chave publishable do projeto
