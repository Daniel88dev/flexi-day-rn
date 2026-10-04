type Element = { type: string; props: Record<string, unknown>; children: Node[] | null };
type Node = Element | string;

const nameOf = (node: Element) =>
  String(node.props.testID ?? node.props.accessibilityLabel ?? node.type);

// Phosphor stamps every icon with a testID of its own; nothing drives the app by those.
const ownTestID = (node: Element) => {
  const id = node.props.testID;
  return typeof id === "string" && !id.startsWith("phosphor-react-native-") ? [id] : [];
};

function testIDsWithin(node: Element): string[] {
  return (node.children ?? []).flatMap((child) =>
    typeof child === "string" ? [] : [...ownTestID(child), ...testIDsWithin(child)]
  );
}

/**
 * Every pressable in a rendered tree that breaks the repo's rule: a testID and an accessibility
 * label on the pressable itself, and no testID inside it, where iOS would hide it.
 */
export function pressableProblems(tree: Element | null): string[] {
  const problems: string[] = [];
  const visit = (node: Node) => {
    if (typeof node === "string") return;
    if (typeof node.props.onClick === "function") {
      if (!node.props.testID) problems.push(`no testID: ${nameOf(node)}`);
      if (!node.props.accessibilityLabel) problems.push(`no label: ${nameOf(node)}`);
      for (const inner of testIDsWithin(node)) problems.push(`${inner} inside ${nameOf(node)}`);
    }
    for (const child of node.children ?? []) visit(child);
  };
  if (tree) visit(tree);
  return problems;
}
