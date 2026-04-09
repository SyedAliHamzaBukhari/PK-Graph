"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Network, BarChart3, BookOpen, Settings } from "lucide-react";
import SimpleGraph from "@/components/SimpleGraph";

interface Concept {
  id: number;
  name: string;
  description: string;
  type: string;
  note_count: number;
  link_count: number;
  avg_importance: number | null;
  created_at: string;
}

interface GraphData {
  nodes: Array<{
    data: {
      id: string;
      label: string;
      type: string;
      root?: boolean;
    };
    classes?: string;
  }>;
  edges: Array<{
    data: {
      id: string;
      source: string;
      target: string;
      label: string;
      strength: number;
    };
    classes?: string;
  }>;
}

export default function Home() {
  const router = useRouter();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [links, setLinks] = useState<Array<{ id: string; source: string; target: string; label: string; strength: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchConcepts();
  }, []);

  useEffect(() => {
    if (!selectedConcept?.id) return;
    fetchLinks(selectedConcept.id);
  }, [selectedConcept]);

  const fetchLinks = async (conceptId: number) => {
    try {
      const resp = await fetch(`/api/graph/visualization/${conceptId}?depth=1`);
      if (!resp.ok) {
        console.error("fetchLinks failed:", await resp.text());
        setLinks([]);
        return;
      }
      const result = await resp.json();
      const edges = result?.data?.edges ?? [];
      // normalize to edge.data
      setLinks(edges.map((e: any) => e.data ?? e));
    } catch (error) {
      console.error("Error fetching links:", error);
      setLinks([]);
    }
  };

  const fetchConcepts = async (query?: string) => {
    setLoading(true);
    try {
      const payload = { name: query?.trim() ?? "" }; // use q to match common APIs
      if (!payload.name) return;

      console.log("fetchConcepts payload:", payload);

      const response = await fetch("/api/search/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("/api/search/concepts status:", response.status);
      if (!response.ok) {
        const txt = await response.text();
        console.error("search concepts failed:", response.status, txt);
        setConcepts([]);
        return;
      }

      const result = await response.json();
      // tolerate multiple response shapes
      const data = result?.data ?? result?.results ?? result?.items ?? [];
      setConcepts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching concepts:", error);
      setConcepts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchConcepts(searchQuery);
  };

  const handleConceptSelect = async (concept: Concept) => {
    setSelectedConcept(concept);
    setGraphData(null); // clear previous graph while loading
    try {
      console.log("fetching graph for", concept.id);
      const resp = await fetch(`/api/graph/visualization/${concept.id}?depth=2`);
      console.log("/api/graph/... status:", resp.status);
      if (!resp.ok) {
        console.error("graph fetch failed:", await resp.text());
        return;
      }
      const result = await resp.json();
      const data = result?.data ?? result?.graph ?? result?.results ?? null;
      if (data) setGraphData(data);
    } catch (error) {
      console.error("Error fetching graph data:", error);
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      concept: "bg-blue-100 text-blue-800",
      person: "bg-green-100 text-green-800",
      place: "bg-yellow-100 text-yellow-800",
      event: "bg-purple-100 text-purple-800",
      document: "bg-red-100 text-red-800",
      idea: "bg-indigo-100 text-indigo-800",
      other: "bg-gray-100 text-gray-800",
    };
    return (colors as any)[type] || colors.other;
  };

  const safeAvg = (c: Concept) => Number(c.avg_importance ?? 0).toFixed(2);

  const handleNewConcept = () => {
    // change to whatever flow you want (modal / page)
    router.push("/concepts/new");
  };

  const conceptsCount = concepts.length;
  const totalNotes = concepts.reduce((sum, c) => sum + (c.note_count || 0), 0);
  const totalLinks = concepts.reduce((sum, c) => sum + (c.link_count || 0), 0);
  const avgImportance = conceptsCount > 0 ? (concepts.reduce((s, c) => s + (c.avg_importance ?? 0), 0) / conceptsCount).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Network className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold">Personal Knowledge Graph</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search concepts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-64"
                />
                <Button onClick={handleSearch} size="sm" disabled={loading}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={handleNewConcept}>
                <Plus className="h-4 w-4 mr-2" />
                New Concept
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="concepts" className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>Concepts</span>
            </TabsTrigger>
            <TabsTrigger value="graph" className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <span>Graph View</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Search</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Concepts</CardTitle>
                  <Network className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conceptsCount}</div>
                  <p className="text-xs text-muted-foreground">Knowledge entities</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalNotes}</div>
                  <p className="text-xs text-muted-foreground">Attached notes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Links</CardTitle>
                  <Network className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalLinks}</div>
                  <p className="text-xs text-muted-foreground">Relationships</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Importance</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgImportance}</div>
                  <p className="text-xs text-muted-foreground">Average score</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Concepts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Concepts</CardTitle>
                <CardDescription>Recently added or updated knowledge concepts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {concepts.slice(0, 5).map((concept) => (
                    <div
                      key={concept.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleConceptSelect(concept)}
                    >
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="font-medium">{concept.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">{concept.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getTypeColor(concept.type)}>{concept.type}</Badge>
                        <Badge variant="outline">{concept.note_count} notes</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Concepts Tab */}
          <TabsContent value="concepts" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">All Concepts</h2>
              <Button onClick={handleNewConcept}>
                <Plus className="h-4 w-4 mr-2" />
                Add Concept
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Loading concepts...</p>
                </div>
              ) : (
                concepts.map((concept) => (
                  <Card key={concept.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleConceptSelect(concept)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{concept.name}</CardTitle>
                        <Badge className={getTypeColor(concept.type)}>{concept.type}</Badge>
                      </div>
                      <CardDescription className="line-clamp-2">{concept.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{concept.note_count} notes</span>
                        <span>{concept.link_count} links</span>
                        <span>Importance: {safeAvg(concept)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Graph View Tab */}
          <TabsContent value="graph" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Knowledge Graph Visualization</h2>
              {selectedConcept && (
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Selected: {selectedConcept.name}</Badge>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </div>
              )}
            </div>

            {selectedConcept ? (
              <Card>
                <CardHeader>
                  <CardTitle>Graph: {selectedConcept.name}</CardTitle>
                  <CardDescription>Interactive visualization of knowledge relationships</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 border rounded-lg bg-muted/10">
                    {graphData ? (
                      <>
                        <SimpleGraph
                          nodes={graphData.nodes.map((node) => ({ ...node.data, classes: node.classes }))}
                          edges={graphData.edges.map((edge) => ({ ...edge.data, classes: edge.classes }))}
                          width={800}
                          height={384}
                        />
                        <div className="p-3 text-sm text-muted-foreground">{`${graphData.nodes.length} nodes, ${graphData.edges.length} edges`}</div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <Network className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                          <h3 className="text-lg font-medium mb-2">Graph Visualization</h3>
                          <p className="text-muted-foreground">{selectedConcept ? "Loading graph..." : "Select a concept to visualize"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Network className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Select a Concept</h3>
                    <p className="text-muted-foreground">Choose a concept from the list to visualize its knowledge graph</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Search</CardTitle>
                <CardDescription>Search across concepts, notes, and relationships</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Search Query</label>
                    <Input placeholder="Enter search terms..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Concept Type</label>
                    <select className="w-full p-2 border rounded-md">
                      <option value="">All Types</option>
                      <option value="concept">Concept</option>
                      <option value="person">Person</option>
                      <option value="place">Place</option>
                      <option value="event">Event</option>
                      <option value="document">Document</option>
                      <option value="idea">Idea</option>
                    </select>
                  </div>
                </div>
                <Button onClick={handleSearch} className="w-full" disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </CardContent>
            </Card>

            {/* Search Results */}
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Searching...</p>
              </div>
            )}

            {!loading && concepts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concepts.map((concept) => (
                  <Card key={concept.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleConceptSelect(concept)}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{concept.name}</h4>
                        <Badge className={getTypeColor(concept.type)}>{concept.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{concept.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Concept Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(
                      (concepts || []).reduce((acc, concept) => {
                        acc[concept.type] = (acc[concept.type] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="capitalize">{type}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Concepts by Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...concepts]
                      .sort((a, b) => b.note_count - a.note_count)
                      .slice(0, 5)
                      .map((concept) => (
                        <div key={concept.id} className="flex items-center justify-between">
                          <span className="text-sm">{concept.name}</span>
                          <Badge variant="outline">{concept.note_count}</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
