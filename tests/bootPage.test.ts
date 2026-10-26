import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';

/**
 * The blank dark page: opened by double-clicking index.html (file://), the game cannot run, and the page used
 * to stay empty. It must say why and how to start the game instead. The module script is dropped here (it
 * needs Vite); only the page's own inline script runs.
 */
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8').replace(/<script type="module"[^>]*><\/script>/, '');

function open(url: string) {
  const window = new Window({ url });
  window.document.write(html);
  return window;
}

describe('página inicial', () => {
  it('aberta do disco (file://), explica como iniciar o jogo em vez de ficar vazia', () => {
    const window = open('file:///C:/Users/user/Downloads/conectando-sonhos-v7/shinichi-game/index.html');
    const help = window.document.getElementById('boot-help')!;
    expect(help.style.display).toBe('block');
    expect(help.textContent).toContain('Jogar.cmd');
    expect(help.textContent).toContain('npm run dev');
    window.close();
  });

  it('servida por http, não mostra aviso nenhum enquanto o jogo carrega', () => {
    const window = open('http://localhost:5173/');
    expect(window.document.getElementById('boot-help')!.style.display).not.toBe('block');
    window.close();
  });

  it('a página aponta o manifesto da PWA e o ícone', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(fs.existsSync(path.resolve(__dirname, '../public/manifest.webmanifest'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/manifest.webmanifest'), 'utf8'));
    // relative start and scope: the same manifest works at "/" and at "/<repository>/"
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    for (const icon of manifest.icons) expect(fs.existsSync(path.resolve(__dirname, '../public', icon.src)), icon.src).toBe(true);
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  });
});
