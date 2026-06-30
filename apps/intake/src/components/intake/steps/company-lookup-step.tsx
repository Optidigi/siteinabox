import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FilePenLine, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/components/intake/hooks";
import { LoadingDots } from "@/components/intake/progress";
import {
  canSearchKvk,
  getSearchError,
  searchKvk,
  type IntakeChoice,
  type KvkSearchResult,
} from "@/components/intake/model";
import { cn } from "@/components/ui/utils";

function CompanyResultSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[8px] border border-intake-border bg-background shadow-[0_12px_32px_rgba(35,35,35,0.08)]"
      aria-label="Bedrijf zoeken"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="min-h-[74px] border-b border-intake-divider px-5 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-48 max-w-[72%] bg-intake-skeleton" />
          <Skeleton className="mt-3 h-3 w-64 max-w-full bg-intake-skeleton" />
        </div>
      ))}
    </div>
  );
}

function CompanySearchEmpty() {
  return (
    <div
      className="rounded-[8px] border border-intake-border bg-background px-5 py-5 shadow-[0_12px_32px_rgba(35,35,35,0.08)]"
      role="status"
    >
      <p className="text-base font-normal leading-6 text-intake-text">
        Geen bedrijf gevonden
      </p>
      <p className="mt-1 text-sm leading-5 text-intake-muted-text">
        Controleer de naam of het KVK-nummer, of vul je gegevens handmatig in.
      </p>
    </div>
  );
}

function CompanySearchError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-[8px] border border-intake-border bg-background px-5 py-5 shadow-[0_12px_32px_rgba(35,35,35,0.08)]"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 size-5 shrink-0 text-intake-muted-text"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-normal leading-6 text-intake-text">
            Zoeken lukt nu niet
          </p>
          <p className="mt-1 text-sm leading-5 text-intake-muted-text">
            Probeer het opnieuw of ga handmatig verder.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="mt-4 h-10 rounded-full border-intake-border-accent bg-background px-4 text-sm font-normal text-intake-text shadow-none hover:bg-intake-panel"
          >
            <RefreshCcw
              className="size-4"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Opnieuw proberen
          </Button>
        </div>
      </div>
    </div>
  );
}

function SearchButtonContent({ loading }: { loading: boolean }) {
  if (!loading) {
    return <Search className="size-6" strokeWidth={1.75} />;
  }

  return (
    <>
      <span className="sr-only">Zoeken</span>
      <LoadingDots />
    </>
  );
}

function CompanyResultsList({
  results,
  activeIndex,
  onActiveIndexChange,
  onSelectCompany,
}: {
  results: KvkSearchResult[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelectCompany: (company: KvkSearchResult) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-[8px] border border-intake-border bg-background shadow-[0_12px_32px_rgba(35,35,35,0.08)]"
      aria-live="polite"
    >
      <Command shouldFilter={false} className="rounded-none bg-background">
        <ScrollArea
          className={cn(results.length > 3 && "h-[204px] sm:h-[246px]")}
        >
          <CommandList className="max-h-none overflow-visible p-0">
            <CommandEmpty>Geen bedrijf gevonden</CommandEmpty>
            <CommandGroup className="p-0">
              {results.map((company, index) => {
                const details = [
                  `KVK ${company.kvkNumber}`,
                  company.city,
                  company.type,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <CommandItem
                    key={company.id}
                    value={`${company.name} ${company.kvkNumber} ${company.branchNumber ?? ""}`}
                    aria-selected={activeIndex === index}
                    onMouseMove={() => onActiveIndexChange(index)}
                    onSelect={() => onSelectCompany(company)}
                    style={
                      activeIndex === index
                        ? { backgroundColor: "var(--intake-panel)" }
                        : undefined
                    }
                    className={cn(
                      "min-h-[74px] cursor-pointer rounded-none border-b border-intake-divider px-5 py-4 text-left last:border-b-0 data-[selected=true]:bg-transparent data-[selected=true]:text-intake-text",
                      activeIndex === index && "bg-intake-panel",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-normal leading-6 text-intake-text">
                        {company.name}
                      </p>
                      <p className="mt-1 truncate text-sm leading-5 text-intake-muted-text">
                        {details}
                      </p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </ScrollArea>
      </Command>
    </div>
  );
}

function SelectedCompanySummary({
  company,
  onChange,
}: {
  company: KvkSearchResult;
  onChange: () => void;
}) {
  const details = [`KVK ${company.kvkNumber}`, company.city, company.type]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4 rounded-[8px] border border-intake-primary bg-intake-success-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-base font-normal leading-6 text-intake-text">
          {company.name}
        </p>
        <p className="mt-1 text-sm leading-5 text-intake-soft-text">
          {details}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onChange}
        className="h-11 shrink-0 rounded-full border-intake-border-accent bg-background px-5 text-base font-normal text-intake-text shadow-none hover:bg-intake-panel"
      >
        Wijzigen
      </Button>
    </div>
  );
}

export function CompanyLookupStep({
  selectedChoice,
  selectedCompany,
  onChoiceChange,
  onCompanyChange,
}: {
  selectedChoice: IntakeChoice;
  selectedCompany: KvkSearchResult | null;
  onChoiceChange: (choice: IntakeChoice) => void;
  onCompanyChange: (company: KvkSearchResult | null) => void;
}) {
  const searchId = useId();
  const resultsPanelId = `${searchId}-results-panel`;
  const [query, setQuery] = useState("");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [activeListId, setActiveListId] = useState<string | undefined>();
  const [activeOptionId, setActiveOptionId] = useState<string | undefined>();
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 400);
  const searchError = getSearchError(debouncedQuery);
  const shouldSearch = canSearchKvk(debouncedQuery) && !searchError;
  const manualSelected = selectedChoice === "manual";
  const search = useQuery({
    queryKey: ["kvk-search", debouncedQuery],
    queryFn: ({ signal }) => searchKvk(debouncedQuery, signal),
    enabled: shouldSearch,
    staleTime: 1000 * 60 * 5,
  });

  const results = search.data?.results ?? [];
  const showResults =
    !selectedCompany && !search.isFetching && results.length > 0;
  const showNoResults =
    !selectedCompany &&
    !search.isFetching &&
    shouldSearch &&
    search.data &&
    results.length === 0;
  const showSearchError =
    !selectedCompany && !search.isFetching && shouldSearch && search.isError;
  const showSuggestions =
    !selectedCompany &&
    !suggestionsDismissed &&
    (search.isFetching || showResults || showNoResults || showSearchError);
  const activeCompany = showResults
    ? (results[activeResultIndex] ?? results[0])
    : null;

  useEffect(() => {
    setActiveResultIndex(0);
  }, [debouncedQuery, results.length]);

  useEffect(() => {
    if (!showSuggestions) {
      setActiveListId(undefined);
      setActiveOptionId(undefined);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const panel = document.getElementById(resultsPanelId);
      const listId = panel?.querySelector("[cmdk-list]")?.id;
      const itemId =
        panel?.querySelectorAll("[cmdk-item]")?.[activeResultIndex]?.id;
      setActiveListId(listId || undefined);
      setActiveOptionId(itemId || undefined);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeResultIndex, results.length, resultsPanelId, showSuggestions]);

  useEffect(() => {
    if (!activeOptionId) return;

    document.getElementById(activeOptionId)?.scrollIntoView({
      block: "nearest",
    });
  }, [activeOptionId]);

  function handleQueryChange(value: string) {
    setQuery(value);
    onCompanyChange(null);
    setActiveResultIndex(0);
    setSuggestionsDismissed(false);

    if (selectedChoice === "company") {
      onChoiceChange(null);
    }
  }

  function handleSelectCompany(company: KvkSearchResult) {
    onCompanyChange(company);
    setSuggestionsDismissed(true);
    onChoiceChange("company");
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && showSuggestions) {
      event.preventDefault();
      setSuggestionsDismissed(true);
      return;
    }

    if (!showResults) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex((index) => (index + 1) % results.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex(
        (index) => (index - 1 + results.length) % results.length,
      );
    }

    if (event.key === "Enter" && activeCompany) {
      event.preventDefault();
      handleSelectCompany(activeCompany);
    }
  }

  function handleSearch(event: { preventDefault: () => void }) {
    event.preventDefault();

    if (activeCompany) {
      handleSelectCompany(activeCompany);
    }
  }

  return (
    <div className="w-full max-w-[780px]">
      <div className="grid gap-6 md:gap-7">
        <Card
          className={cn(
            "gap-0 rounded-[8px] border-intake-border bg-background px-6 py-7 shadow-none transition-colors md:px-8 md:py-8",
            selectedChoice === "company" && "border-intake-primary",
          )}
        >
          <CardContent className="px-0">
            <form onSubmit={handleSearch} noValidate>
              <FieldGroup className="gap-5">
                <Field data-invalid={Boolean(searchError)}>
                  <FieldLabel
                    htmlFor={searchId}
                    className="mb-6 text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8"
                  >
                    Zoek op bedrijfsnaam of KVK-nummer
                  </FieldLabel>
                  <Popover
                    open={showSuggestions}
                    onOpenChange={(open) => {
                      if (!open) setSuggestionsDismissed(true);
                    }}
                  >
                    <PopoverAnchor asChild>
                      <div>
                        <InputGroup
                          className={cn(
                            "h-[58px] rounded-[8px] border-intake-border-strong bg-background shadow-none md:h-[66px]",
                            searchError && "border-destructive",
                          )}
                        >
                          <InputGroupInput
                            id={searchId}
                            type="text"
                            inputMode="search"
                            autoComplete="off"
                            placeholder="Janssen Schilderwerken of 12345678"
                            value={query}
                            onChange={(event) =>
                              handleQueryChange(event.target.value)
                            }
                            onKeyDown={handleSearchKeyDown}
                            aria-invalid={Boolean(searchError)}
                            aria-describedby={`${searchId}-error`}
                            aria-autocomplete="list"
                            aria-controls={activeListId}
                            aria-expanded={showSuggestions}
                            aria-activedescendant={activeOptionId}
                            role="combobox"
                            className="h-[58px] px-5 text-base font-normal placeholder:text-intake-muted-text md:h-[66px] md:text-lg"
                          />
                          <InputGroupAddon align="inline-end" className="pr-2">
                            <InputGroupButton
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Zoeken"
                              disabled
                              className="size-11 rounded-full text-intake-text hover:bg-intake-success-surface disabled:opacity-40 md:size-12 [&>span]:text-intake-primary"
                            >
                              <SearchButtonContent
                                loading={search.isFetching}
                              />
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                      </div>
                    </PopoverAnchor>

                    <PopoverContent
                      id={resultsPanelId}
                      align="start"
                      sideOffset={12}
                      onOpenAutoFocus={(event) => event.preventDefault()}
                      onCloseAutoFocus={(event) => event.preventDefault()}
                      className="z-30 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-3rem)] rounded-[8px] border-0 bg-transparent p-0 text-popover-foreground shadow-none outline-none"
                    >
                      {search.isFetching ? <CompanyResultSkeleton /> : null}

                      {showResults ? (
                        <CompanyResultsList
                          results={results}
                          activeIndex={activeResultIndex}
                          onActiveIndexChange={setActiveResultIndex}
                          onSelectCompany={handleSelectCompany}
                        />
                      ) : null}

                      {showNoResults ? <CompanySearchEmpty /> : null}

                      {showSearchError ? (
                        <CompanySearchError
                          onRetry={() => {
                            setSuggestionsDismissed(false);
                            void search.refetch();
                          }}
                        />
                      ) : null}
                    </PopoverContent>
                  </Popover>
                  <FieldError
                    id={`${searchId}-error`}
                    className="mt-3 text-sm leading-5"
                  >
                    {searchError}
                  </FieldError>
                </Field>

                {selectedCompany ? (
                  <SelectedCompanySummary
                    company={selectedCompany}
                    onChange={() => {
                      onCompanyChange(null);
                      onChoiceChange(null);
                    }}
                  />
                ) : null}
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          aria-pressed={manualSelected}
          onClick={() => {
            onCompanyChange(null);
            setSuggestionsDismissed(true);
            onChoiceChange("manual");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            onCompanyChange(null);
            setSuggestionsDismissed(true);
            onChoiceChange("manual");
          }}
          className={cn(
            "cursor-pointer gap-0 rounded-[12px] border-intake-border bg-background px-6 py-6 shadow-none transition-colors hover:border-intake-border-accent hover:bg-intake-subtle focus-visible:border-intake-primary focus-visible:ring-[3px] focus-visible:ring-intake-primary/20 focus-visible:outline-none md:px-8",
            manualSelected &&
              "border-intake-primary bg-intake-success-surface hover:border-intake-primary hover:bg-intake-success-surface",
          )}
        >
          <CardContent className="px-0">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[12px] bg-intake-subtle text-intake-text sm:size-16">
                <FilePenLine
                  className="size-7 sm:size-8"
                  strokeWidth={1.65}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-normal leading-6 text-intake-text">
                  Vul je gegevens liever zelf in?
                </CardTitle>
                <FieldDescription className="mt-1 max-w-none text-base leading-6 text-intake-muted-text">
                  Handig als je nog geen KVK hebt of handmatig verder wilt gaan.
                </FieldDescription>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
