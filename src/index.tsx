import {
  ActionPanel,
  CopyToClipboardAction,
  List,
  OpenInBrowserAction,
  showToast,
  ToastStyle,
  randomId,
} from "@raycast/api";

import { useState, useEffect, useRef } from "react";
import fetch, { AbortError } from "node-fetch";

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List isLoading={state.isLoading} onSearchTextChange={search} searchBarPlaceholder="Search by name..." throttle>
      <List.Section title="Results" subtitle={state.total + ""}>
        {state.results.map((searchResult) => (
          <SearchListItem key={searchResult.id} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }: { searchResult: SearchResult }) {
  return (
    <List.Item
      title={searchResult.name}
      subtitle={searchResult.description}
      accessoryTitle={`↓ ${searchResult.downloads}, ★ ${searchResult.favers}`}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <CopyToClipboardAction
              title="Copy Install Command"
              content={`composer require ${searchResult.name}`}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <OpenInBrowserAction title="Open Packagist Page" url={searchResult.url}
              shortcut={{ modifiers: ["cmd"], key: "return" }} 
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <OpenInBrowserAction title="Open Repository Page" url={searchResult.repository} 
              shortcut={{ modifiers: ["cmd"], key: "arrowRight" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: false, total: 0 });
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);


  async function search(searchText: string) {
    if (searchText === "") {
      return
    }
    cancelRef.current?.abort();
    cancelRef.current = new AbortController();
    try {
      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));
      const [results,total] = await performSearch(searchText, cancelRef.current.signal);
      setState((oldState) => ({
        ...oldState,
        results: results,
        isLoading: false,
        total: total
      }));
    } catch (error) {
      if (error instanceof AbortError) {
        return;
      }
      console.error("search error", error);
      showToast(ToastStyle.Failure, "Could not perform search", String(error));
    }
  }

  return {
    state: state,
    search: search,
  };
}

async function performSearch(searchText: string, signal: AbortSignal): Promise<[SearchResult[],number]> {
  const params = new URLSearchParams();
  params.append("q", searchText.length === 0 ? "@raycast/api" : searchText);



  const response = await fetch("https://packagist.org/search.json" + "?" + params.toString(), {
    method: "get",
    signal: signal,
  });
  
  if (!response.ok) {
    return Promise.reject(response.statusText);
  }

  
  type Json = Record<string, unknown>;
  
  const json = (await response.json()) as Json;

  const jsonResults = (json?.results as Json[]) ?? [];
  const results = jsonResults.map((composerPackage) => {
    return {
      id: randomId(),
      name: composerPackage.name as string,
      description: (composerPackage?.description as string) ?? "",
      url: composerPackage.url as string,
      downloads: (composerPackage?.downloads as string) ?? "",
      favers: (composerPackage?.favers as string) ?? "",
      repository: composerPackage.repository as string,
    };
  });

  return [results, json.total as number];
}

interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
  total: number;
}

interface SearchResult {
  id: string;
  name: string;
  description: string;
  downloads?: string;
  favers?: string;
  repository: string;
  url: string;
}
