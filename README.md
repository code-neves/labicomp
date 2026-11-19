# Labicomp

Jogo de programação com labirintos quadrados procedurais. Os estudantes organizam blocos de movimento para levar o explorador da saída de sua equipe ao objetivo central. O labirinto pode ser ajustado entre 15 × 15 e 41 × 41, com 2 a 12 equipes. O código do labirinto reproduz a mesma configuração.

O jogo permite editar e executar o algoritmo de cada equipe, acompanhar uma demonstração simultânea das rotas e ajustar a velocidade da demonstração.

## Como executar

Abra `index.html` em um navegador. Não há etapa de build. A geração e a execução do labirinto funcionam localmente; o QR de compartilhamento usa uma conexão HTTPS.

## Arquivos

- `index.html` — interface do jogo
- `assets/css/theme.css` — tokens e estilos base do tema
- `assets/css/game.css` — layout e estilos do jogo
- `assets/js/game.js` — geração do labirinto, equipes e execução dos algoritmos
- `assets/js/koi.js` — animação de fundo
