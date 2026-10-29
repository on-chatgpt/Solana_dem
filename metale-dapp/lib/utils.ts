export async function setClipboard(text: string) {
  const type = "text/plain";
  const blob = new Blob([text], {type});
  const data = [new ClipboardItem({[type]: blob})];

  await navigator.clipboard.write(data)
}
