import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function Fraction({ num, den }) {
  return (
    <span className="inline-flex flex-col items-center align-middle mx-1 text-center leading-tight" data-testid="frac">
      <span className="px-1.5">{num}</span>
      <span className="block w-full border-t border-current my-0.5" />
      <span className="px-1.5">{den}</span>
    </span>
  );
}

function buildComponents(checkbox) {
  const c = {
    h1: (p) => <h1 className="font-head font-bold text-2xl mt-5 mb-2 text-white">{p.children}</h1>,
    h2: (p) => <h2 className="font-head font-bold text-xl mt-5 mb-2 text-white">{p.children}</h2>,
    h3: (p) => <h3 className="font-head font-semibold text-lg mt-4 mb-1.5 text-white/95">{p.children}</h3>,
    p: (p) => <p className="my-2.5 leading-relaxed text-white/80">{p.children}</p>,
    strong: (p) => <strong className="font-semibold text-white">{p.children}</strong>,
    em: (p) => <em className="italic text-white/80">{p.children}</em>,
    ul: (p) => <ul className="list-disc pl-5 my-2.5 space-y-1 text-white/80">{p.children}</ul>,
    ol: (p) => <ol className="list-decimal pl-5 my-2.5 space-y-1 text-white/80">{p.children}</ol>,
    blockquote: (p) => <blockquote className="border-l-2 border-ace-violet pl-4 my-3 text-white/70 italic">{p.children}</blockquote>,
    table: (p) => <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse">{p.children}</table></div>,
    th: (p) => <th className="border border-white/15 px-3 py-2 text-left bg-white/5 font-semibold">{p.children}</th>,
    td: (p) => <td className="border border-white/10 px-3 py-2">{p.children}</td>,
    a: (p) => <a href={p.href} className="text-ace-cyan underline">{p.children}</a>,
    hr: () => <hr className="border-white/10 my-4" />,
    code: (p) => <code className="bg-white/10 rounded px-1.5 py-0.5 text-ace-cyan text-[0.9em]">{p.children}</code>,
    li: (p) => <li className="leading-relaxed">{p.children}</li>,
  };
  if (checkbox) {
    c.input = (p) => {
      if (p.type === "checkbox") {
        const i = checkbox.next();
        return (
          <input type="checkbox" data-testid={`checklist-item-${i}`} checked={!!checkbox.state[i]}
            onChange={() => checkbox.onToggle(i)} className="w-4 h-4 mr-2 accent-ace-violet cursor-pointer align-middle" />
        );
      }
      return <input type={p.type} />;
    };
    c.li = (p) => {
      const isTask = p.className && p.className.includes("task-list-item");
      return <li className={isTask ? "list-none -ml-4 leading-relaxed flex items-start gap-1 my-1.5" : "leading-relaxed"}>{p.children}</li>;
    };
  }
  return c;
}

function renderTokens(text, checkbox, keyBase) {
  const tokenRe = /\[\[frac:([^|\]]*)\|([^\]]*)\]\]|\[\[center:([\s\S]*?)\]\]/g;
  const out = [];
  let last = 0, m, k = 0;
  const comps = buildComponents(checkbox);
  const pushMd = (str) => {
    if (str && str.trim()) {
      out.push(<ReactMarkdown key={`${keyBase}-md-${k++}`} remarkPlugins={[remarkGfm]} components={comps}>{str}</ReactMarkdown>);
    }
  };
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) pushMd(text.slice(last, m.index));
    if (m[3] !== undefined) {
      // center: render inner fractions/text without deeper markdown blocks
      out.push(<div key={`${keyBase}-c-${k++}`} className="text-center my-3 text-lg text-white">{renderCenter(m[3])}</div>);
    } else {
      out.push(<Fraction key={`${keyBase}-f-${k++}`} num={m[1]} den={m[2]} />);
    }
    last = tokenRe.lastIndex;
  }
  if (last < text.length) pushMd(text.slice(last));
  return out;
}

function renderCenter(text) {
  const fracRe = /\[\[frac:([^|\]]*)\|([^\]]*)\]\]/g;
  const out = [];
  let last = 0, m, k = 0;
  while ((m = fracRe.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={`ct-${k++}`}>{text.slice(last, m.index)}</span>);
    out.push(<Fraction key={`cf-${k++}`} num={m[1]} den={m[2]} />);
    last = fracRe.lastIndex;
  }
  if (last < text.length) out.push(<span key={`ct-${k++}`}>{text.slice(last)}</span>);
  return out;
}

export default function RichText({ content, className = "", checkbox = null }) {
  if (!content) return null;
  return <div className={`text-[15px] ${className}`}>{renderTokens(String(content), checkbox, "rt")}</div>;
}
