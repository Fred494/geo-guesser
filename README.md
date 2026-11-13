# Jogos da Noite — GeoGuesser (mini jogo 1)

Site estático (GitHub Pages). O portátil é o anfitrião (`host.html`), os telemóveis são os jogadores (`play.html`), ligados por WebRTC (PeerJS). Não há servidor nem contas.

## Estrutura
```
docs/                      <- é isto que o GitHub Pages publica
  index.html               entrada (anfitrião ou jogador)
  host.html / play.html    ecrã do portátil / do telemóvel
  questions.json           TODAS as perguntas (edita à vontade)
  img/                     fotos otimizadas (~2500 px)
  core/                    lobby, jogadores, placar, ligação (partilhado por todos os mini jogos)
  games/geoguesser/        o GeoGuesser (host.js e player.js)
tools/                     ferramentas só para ti (não fazem parte do site)
```
As fotos originais (`Lisboa/`, `Portugal/`, `Mundo/`, `HardCore/`) ficam só no teu computador e não vão para o GitHub.

Para um novo mini jogo: criar `docs/games/<nome>/host.js` (regista `Games.<nome>`) e `player.js` (regista vistas em `PlayerViews`), e acrescentar os `<script>` em `host.html` / `play.html`. Os jogadores e o placar já são partilhados.

## Testar localmente
```
cd tools
node serve.mjs
```
- No portátil abre `http://localhost:8080/host.html`.
- Jogadores de teste: abre `http://localhost:8080/play.html?room=CODIGO` noutros separadores (cada separador é um jogador).
- Telemóveis reais: abre no portátil o endereço de rede que o `serve.mjs` mostra (ex. `http://192.168.1.72:8080/host.html`) para o QR code apontar para lá. Telemóveis e portátil na mesma wifi. É preciso internet (o PeerJS usa um servidor público para ligar os aparelhos).

## Editar perguntas (`docs/questions.json`)
- Escolha múltipla (`lisboa`, `portugal`, `mundo`): `answer` = opção certa, `wrong` = 3 erradas. A ordem é baralhada no jogo.
- Hard-core (`hardcore`): `answer` + `accepted` (outras respostas aceites).
- `settings`: zoom inicial, durações, pontos e níveis de zoom do hard-core.

## Acrescentar fotos novas
Forma fácil: põe a foto na pasta certa (ex. `Lisboa/`) e corre, na pasta `tools`:
```
node add-photo.mjs lisboa "..\Lisboa\minha-foto.jpg" "Resposta certa" "Errada 1" "Errada 2" "Errada 3"
node add-photo.mjs hardcore "..\HardCore\outra.jpg" "Resposta" "outra resposta aceite"
```
(secções: `lisboa`, `portugal`, `mundo`, `hardcore`). O script otimiza a foto para `docs/img/` e acrescenta a pergunta ao `questions.json`. Podes ter quantas fotos quiseres por secção.

## Sons ao bloquear
1. Põe os ficheiros de som (mp3, wav, ogg…) na pasta `docs/sounds/`. Sons curtos (1–3 s); tocam no máximo 3,5 s.
2. Corre `node build-sounds.mjs` na pasta `tools`. O nome que os jogadores veem é o nome do ficheiro.
3. Cada jogador escolhe o seu som ao entrar (toca para ouvir). Quem não escolher usa o "bip" normal.

## Pontuação
Definida em `docs/questions.json` → `settings`: escolha múltipla 10 s no total (800 → 200 durante 8 s, 200 nos últimos 2 s); hard-core 25 s (1500 → 300 em linha reta, 300 nos últimos 2 s). Aumenta o `mcZoomSeconds` ou muda `mcMaxPoints` para ajustar.

Depois de editar: `git add -A`, `git commit -m "..."`, `git push`. O site atualiza em 1–2 minutos.
