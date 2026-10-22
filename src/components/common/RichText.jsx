import { parseInlineRichText, parseRichText } from '../../utils/richText';

function Inline({ nodes }) {
  return nodes.map((node, index) => {
    if (node.type === 'text') return node.text;
    const Tag = node.type;
    return <Tag key={index}>{node.type === 'code' ? node.text : <Inline nodes={node.children} />}</Tag>;
  });
}

export default function RichText({ value, className = '', style, inline = false, ...props }) {
  if (inline) return <span className={`dn-rich-text dn-rich-text-inline ${className}`} style={style} {...props}><Inline nodes={parseInlineRichText(value)} /></span>;
  return (
    <div className={`dn-rich-text ${className}`} style={style} {...props}>
      {parseRichText(value).map((block, index) => {
        if (block.type === 'heading') {
          const Tag = `h${block.level + 2}`;
          return <Tag key={index}><Inline nodes={block.children} /></Tag>;
        }
        if (block.type === 'quote') return <blockquote key={index}><Inline nodes={block.children} /></blockquote>;
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return <Tag key={index} start={block.ordered ? Math.min(999999, block.start) : undefined}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline nodes={item} /></li>)}</Tag>;
        }
        return <div className="dn-rich-text-line" key={index}><Inline nodes={block.children} />{block.children.length === 1 && block.children[0].text === '' ? <br /> : null}</div>;
      })}
    </div>
  );
}
