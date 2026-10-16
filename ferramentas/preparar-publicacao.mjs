import { mkdir, readdir, lstat, realpath, rm, copyFile } from "node:fs/promises";
import { dirname, resolve, relative, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = resolve(raiz, "dist");
if (relative(raiz, destino) !== "dist") throw new Error("Diretório de publicação inválido.");
try {
  const info = await lstat(destino);
  if (info.isSymbolicLink() || !info.isDirectory() || await realpath(destino) !== destino) {
    throw new Error("A pasta dist deve ser um diretório local, sem links.");
  }
  // Remove somente a saída gerada e verificada dentro deste projeto.
  await rm(destino, { recursive: true });
} catch (erro) {
  if (erro.code !== "ENOENT") throw erro;
}
await mkdir(destino);

async function copiar(pasta, extensoes) {
  for (const entrada of await readdir(resolve(raiz, pasta), { withFileTypes: true })) {
    if (entrada.name.startsWith(".")) continue;
    const caminho = resolve(raiz, pasta, entrada.name);
    const info = await lstat(caminho);
    if (info.isSymbolicLink()) throw new Error(`Link não permitido: ${pasta}/${entrada.name}`);
    const relativo = relative(raiz, caminho);
    if (relativo.startsWith(".." + sep)) throw new Error("Arquivo fora do projeto.");
    if (entrada.isDirectory()) await copiar(relativo, extensoes);
    else if (entrada.isFile() && extensoes.has(extname(entrada.name).toLowerCase())) {
      const saida = resolve(destino, relativo);
      await mkdir(dirname(saida), { recursive: true });
      await copyFile(caminho, saida);
    }
  }
}
await copyFile(resolve(raiz, "index.html"), resolve(destino, "index.html"));
for (const pasta of ["aluno", "Professor", "coordenacao"]) await copiar(pasta, new Set([".html", ".css"]));
await copiar("estilos", new Set([".css"]));
await copiar("scripts", new Set([".js"]));
await copiar("imagens", new Set([".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".ico", ".avif"]));
console.log("Publicação preparada em dist. Arquivos de servidor e configurações locais não foram copiados.");
