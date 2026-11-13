// Gera as imagens otimizadas (docs/img) e o docs/questions.json a partir das fotos originais.
// Uso: node build-data.mjs   (só é preciso correr uma vez; depois editas o questions.json à mão)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outImg = path.join(root, "docs", "img");
fs.mkdirSync(outImg, { recursive: true });

const mc = (folder, prefix, rows) =>
  rows.map(([file, ...opts], i) => ({
    file, folder, id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
    answer: opts[0], wrong: opts.slice(1),
  }));

const sections = [
  { id: "lisboa", name: "Lisboa", type: "mc", items: mc("Lisboa", "lisboa", [
    ["Converto do Carmo.webp", "Convento do Carmo", "Portas do Sol", "Sé de Lisboa", "Praça de São Paulo"],
    ["Entrecampos.jpg", "Entrecampos", "Baixa", "Alcântara", "Marvila"],
    ["Entrecampos1.jpg", "Entrecampos", "Príncipe Real", "Areeiro", "Alvalade"],
    ["Estadio do Restelo.jpg", "Estádio do Restelo", "Belém Park", "Estádio do Estoril", "Estádio da Tapadinha"],
    ["Loucos.png", "Loucos", "Sóbrio", "Avião", "Monhés"],
    ["Lumiar.jpg", "Lumiar", "Alfragide", "Miraflores", "Expo"],
    ["Meo Arena.jpg", "MEO Arena", "FIL", "Vasco da Gama", "Pavilhão do Conhecimento"],
    ["Miradouro Jardim do Reconhecimento.jpg", "Miradouro do Jardim do Reconhecimento", "Miradouro da Graça", "Miradouro das Portas do Sol", "Miradouro da Senhora do Monte"],
    ["Olaias.jpg", "Olaias", "Amoreiras", "IADE", "Sede do Banco Nacional Ultramarino"],
    ["Praça da Figueira.jpg", "Praça da Figueira", "Praça do Rossio", "Praça dos Restauradores", "Praça do Martim Moniz"],
    ["PrincipeReal.webp", "Príncipe Real", "Avenida da Liberdade", "Areeiro", "Cais do Sodré"],
  ])},
  { id: "portugal", name: "Portugal", type: "mc", items: mc("Portugal", "portugal", [
    ["Badoca Safari Park.jpg", "Badoca Safari Park", "Zoo de Lisboa", "Aquamarine", "Monte Selvagem"],
    ["Convento de Cristo.jpg", "Convento de Cristo", "Mosteiro dos Jerónimos", "Mosteiro da Batalha", "Mosteiro de Alcobaça"],
    ["Convento de Espichel.jpg", "Santuário do Cabo Espichel", "Santuário da Peninha", "Santuário de Nossa Senhora da Nazaré", "Santuário do Bom Jesus do Monte"],
    ["Estadio Aveiro.jpg", "Estádio de Aveiro", "Estádio de Faro", "Estádio de Coimbra", "Estádio de Leiria"],
    ["Evora.webp", "Évora", "Lisboa", "Elvas", "Algarve"],
    ["Palacio Vila Viçosa.jpg", "Palácio de Vila Viçosa", "Palácio de Queluz", "Paço dos Duques de Bragança", "Palácio de Mateus"],
    ["Piodao, Arganil.png", "Piódão", "Talasnal", "Aigra Nova", "Gondramaz"],
    ["Porto.webp", "Porto", "Guimarães", "Braga", "Bragança"],
    ["Praia do Tonel.webp", "Praia do Tonel", "Praia da Samoqueira", "Praia do Abreijo Largo", "Praia dos Machados"],
    ["Sao Miguel.webp", "São Miguel", "Corvo", "Faial", "Pico"],
    ["Ujo.jpg", "Miradouro de Uijo", "Miradouro de São Leonardo de Galafura", "Miradouro da Pedra Bela", "Miradouro do Cabo Girão"],
  ])},
  { id: "mundo", name: "Mundo", type: "mc", items: mc("Mundo", "mundo", [
    ["Bolivia.webp", "Bolívia", "Peru", "Nepal", "Cazaquistão"],
    ["Brasil.jpg", "Brasil", "Peru", "Egito", "Namíbia"],
    ["China.webp", "China", "Japão", "Singapura", "Coreia do Sul"],
    ["Croacia.jpg", "Croácia", "Montenegro", "Albânia", "Bósnia"],
    ["Emirados Arabes Unidos.webp", "Emirados Árabes Unidos", "Coreia do Sul", "Arábia Saudita", "Malásia"],
    ["England.jpeg", "Inglaterra", "Escócia", "Irlanda", "País de Gales"],
    ["Mexico.jpg", "México", "Guatemala", "Belize", "Indonésia"],
    ["Monte Evereste.jpg", "Evereste", "Fitz Roy", "Kilimanjaro", "Denali"],
    ["Portugal.jpg", "Portugal", "Brasil", "Bolívia", "Itália"],
    ["Praga.webp", "República Checa", "Hungria", "Itália", "Alemanha"],
    ["Scotland.webp", "Escócia", "Inglaterra", "País de Gales", "Irlanda"],
  ])},
  { id: "hardcore", name: "Hard-core", type: "text", items: [
    ["Bateria.jpg", "Bateria", []],
    ["Berlinde.jpg", "Berlinde", ["bolinha de vidro", "marble"]],
    ["Chaleira.png", "Chaleira", ["kettle"]],
    ["Hamster.png", "Hamster", ["porquinho-da-índia", "cobaia"]],
    ["Hockey Gelo.png", "Limpador de gelo", ["alisador de gelo"]],
    ["Koala.webp", "Coala", ["koala"]],
    ["Macarrão.png", "Macarrão", ["macaroni", "massa"]],
    ["papaya.jpg", "Papaia", ["papaya", "mamão"]],
    ["pessego.jpg", "Pêssego", ["peach"]],
    ["yoyo.jpg", "Ioiô", ["yoyo", "yo-yo"]],
  ].map(([file, answer, accepted], i) => ({
    file, folder: "HardCore", id: `hardcore-${String(i + 1).padStart(2, "0")}`, answer, accepted,
  }))},
];

const out = {
  _ajuda: "Edita este ficheiro para mudar perguntas. 'image' é o nome da foto em docs/img/. Nas secções 'mc' (escolha múltipla) a resposta certa é 'answer' e as erradas estão em 'wrong' (a ordem é baralhada no jogo). Na secção 'text' (hard-core) 'accepted' são respostas alternativas aceites.",
  settings: {
    mcStartZoom: 10, mcZoomSeconds: 8, mcExtraSeconds: 2, mcMaxPoints: 800, mcMinPoints: 200,
    textLevelSeconds: 5, textMaxPoints: 1500, textMinPoints: 300, textTailSeconds: 2, textLevels: 5,
    textZoomLevels: [6, 4, 2.6, 1.7, 1],
  },
  sections: [],
};

for (const s of sections) {
  const sec = { id: s.id, name: s.name, type: s.type, questions: [] };
  for (const it of s.items) {
    const src = path.join(root, it.folder, it.file);
    if (!fs.existsSync(src)) throw new Error("Falta: " + src);
    const dest = `${it.id}.jpg`;
    await sharp(src).rotate().resize({ width: 2500, height: 2500, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#fff" }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(outImg, dest));
    const q = { id: it.id, image: dest, answer: it.answer };
    if (s.type === "mc") q.wrong = it.wrong; else q.accepted = it.accepted;
    sec.questions.push(q);
    console.log(it.id, "<-", it.file);
  }
  out.sections.push(sec);
}
fs.writeFileSync(path.join(root, "docs", "questions.json"), JSON.stringify(out, null, 2));
console.log("OK");
