async function main() {
  const response = await fetch("http://localhost:3000/access-reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonprofitName: "Harbor Community Pantry", reportDate: "2026-10-02" })
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
