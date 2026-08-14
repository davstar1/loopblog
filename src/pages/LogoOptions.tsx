import { useState } from "react";

const options = [
  ["01", "Twin orbit"], ["02", "Three-part cycle"], ["03", "Infinity exchange"], ["04", "Rounded relay"], ["05", "Eclipse loop"],
  ["06", "Four-way motion"], ["07", "Comet loop"], ["08", "Pinwheel orbit"], ["09", "Ribbon weave"], ["10", "Minimal twin loop"],
] as const;

export default function LogoOptions() {
  const [selected, setSelected] = useState("01");
  const base = `${import.meta.env.BASE_URL}logo-options/loop-`;
  return <section className="logoLab"><header><p className="profileEyebrow">LoopBlog identity study</p><h1>Choose the loop.</h1><p>Ten original arrow-and-play concepts shown at both header and favicon scale. Selecting one here is only a preview.</p></header><div className="logoLabHero"><img src={`${base}${selected}.svg`} alt={`Selected LoopBlog option ${selected}`} /><div><span>Selected concept</span><b>Option {selected}</b><small>{options.find(([id]) => id === selected)?.[1]}</small></div></div><div className="logoOptionGrid">{options.map(([id, name]) => <button key={id} className={selected === id ? "selected" : ""} onClick={() => setSelected(id)} type="button"><img src={`${base}${id}.svg`} alt="" /><div><b>{id}</b><span>{name}</span></div><i><img src={`${base}${id}.svg`} alt="" /></i></button>)}</div><footer>Tell me the option number you want to use on LoopBlog.</footer></section>;
}
