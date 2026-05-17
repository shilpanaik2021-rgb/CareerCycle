from ddgs import DDGS
with DDGS() as ddgs:
    results = [r for r in ddgs.text("best healthcare jobs", max_results=3)]
    for r in results:
        print(r['href'], r['title'])
