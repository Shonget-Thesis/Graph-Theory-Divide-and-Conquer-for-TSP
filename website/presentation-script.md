# 15-Minute Video Presentation Script

**Project:** Divide and Conquer for the Traveling Salesperson Problem  
**Application:** A one-day city tour of downtown Cagayan de Oro  
**Course:** CS414: Graph Theory  
**Instructor:** Dr. Penelyn L. Acal  
**Presenters:** Heart Chiong, Mark Vincent Limpahan, Roxanne Locsin, and Rhenel Jhon Sajol

## Recording Notes

Open `website/index.html` in a browser and use full screen with `F`. Advance with `Right Arrow`, `PageDown`, or `Space`. On the two implementation player slides, advance through the algorithm steps before moving to the next slide. Use `Shift + Right Arrow` when a slide should be skipped without replaying its animation.

The timings below total approximately 15 minutes. Each member has one equal block of 3 minutes 45 seconds. The words in quotation marks are the suggested narration. Text in brackets describes the screen action and is not spoken.

## Speaker Assignment

| Speaker | Slides and time | Total |
|---|---|---:|
| Heart Chiong | Title, outline, problem, objective, and algorithm introduction | 0:00–3:45 |
| Mark Vincent Limpahan | Algorithm completion, graph model, data, and Google cross-check | 3:45–7:30 |
| Roxanne Locsin | Applying the algorithm, implementation, players, code, and route result | 7:30–11:15 |
| Rhenel Jhon Sajol | Interpretation, optimality, experiments, limitations, and closing | 11:15–15:00 |

At each handoff, the next speaker should begin immediately after the previous speaker's transition sentence.

## 00. Heart Chiong: Title and Outline, 0:00–0:45

### Title slide, 0:00–0:30

[Show the title slide. Let the preloader finish, then point to the interactive K10 graph.] 

“Good day. We are Heart Chiong, Mark Vincent Limpahan, Roxanne Locsin, and Rhenel Jhon Sajol. This presentation is our Performance Innovative Task for CS414 Graph Theory, under Dr. Penelyn L. Acal.

“Our topic is Divide and Conquer for the Traveling Salesperson Problem, applied to a one-day guest tour of downtown Cagayan de Oro. The tour starts at USTP, visits nine landmarks, and returns to USTP. Our goal is to explain the algorithm, show how we implemented it, and evaluate the route it produces.”

[Briefly point at the K10 graph.] “The graph on the right represents ten locations and all 45 possible undirected edges between them.”

### Outline slide, 0:30–0:45

“This presentation has five parts: the problem, the Divide and Conquer algorithm, the graph model and data, the Python implementation and results, and the conclusion. We also provide the references used by the project.”

## 01. Heart Chiong: Problem and Objective, 0:45–2:30

### Divider, 0:45–0:55

[Advance to the Problem divider.] 

“We begin with the problem we are solving: visit every required stop exactly once and come back to the starting point.”

### TSP, 0:55–1:30

[Show the TSP slide.] 

“The Traveling Salesperson Problem asks for a minimum-weight Hamiltonian cycle in a weighted graph. In our case, the vertices are locations, the edges represent driving between locations, and the edge weights are measured in kilometres.

“Exact methods become expensive as the number of locations grows. Brute force has factorial growth, while Held–Karp dynamic programming has complexity O(n²2ⁿ). For ten locations, exact computation is still practical, so we use Held–Karp later as a comparison. The main method, however, is the faster Divide and Conquer heuristic.”

### Real-life problem, 1:30–2:00

[Show the downtown map and identify V0 and a few landmarks.] 

“Our scenario is a one-day city tour by service vehicle. The route starts and ends at V0, the USTP Cagayan de Oro Campus. The required locations include Limketkai Center, Centrio Mall, Pelaez Sports Center, Museo de Oro, Divisoria Plaza, St. Augustine Cathedral, the Port of Cagayan de Oro, Liceo de Cagayan University, and Capitol University.

“The study area is the city centre and nearby barangays, approximately 2.5 by 2.2 kilometres.”

### Objective and assumptions, 2:00–2:30

[Show the objective and assumptions slide.] 

“We minimise total driving distance. The route must start and finish at USTP and visit every other vertex exactly once.

“The road data come from the OSRM Table service using its driving profile and OpenStreetMap road data. OSRM reports the route distance selected for each ordered pair. Because one-way streets make the two directions different, we average the two directed values to create the symmetric matrix used by the solver. Traffic, waiting time, opening hours, and time spent at each stop are outside the model.”

## 02. Heart Chiong to Mark Vincent Limpahan: Algorithm, 2:30–5:25

### Divider, 2:30–2:40 (Heart)

[Show the Algorithm divider.] 

“The algorithm follows Algorithm 2.8 from Luna-Garcia, Candano, and Caga-anan, with a correction to the merge step.”

### Procedure, 2:40–3:35 (Heart)

[Show the procedure slide. Advance through the six steps.] 

“Step 1 shuffles the cities. In our implementation, the later sort uses a deterministic coordinate-and-index key, so the shuffle does not change the splits; it is retained to follow the paper’s procedure.

“Step 2 chooses either longitude or latitude, sorts the cities on that axis, and cuts at the median.

“Step 3 handles the base cases. One city has length zero. Two cities form the closed tour a to b to a, with length twice their edge weight.

“Step 4 solves both halves recursively.

“Step 5 finds the shortest bridge between the two halves.

“Step 6 combines the cycles while ensuring that every city appears exactly once.”

“That explains the recursive procedure. Mark will now discuss the complexity, the merge correction, and how the graph data support the implementation.”

### Complexity and pseudocode, 3:35–4:05 (Mark)

[Show the complexity slide.] 

“The bridge search examines all cross pairs, which is O(n²). The implementation also loops over edge pairs from the two cycles. Most pairs may be skipped, but the loop is still O(n²) in the worst case. The recurrence is T(n) equals 2T(n/2) plus O(n²), giving an overall O(n²) running time.”

### Merge bug and correction, 4:05–5:25 (Mark)

[Show the merge slide. Point to the preserved output.] 

“The paper’s printed merge expression is `tour1[:-1] + [a, b] + tour2`. This inserts bridge cities that already occur in the two tours, so it can repeat vertices and fail to close at the start. Our preserved seven-city run returns eight entries, repeats V5, and does not form a valid closed tour.

“Our correction removes one edge from each cycle and adds two cross edges: the shortest bridge and a closing edge. The result is one cycle containing every city exactly once. We also implemented a best-splice variant that tries all edge-pair combinations instead of requiring the shortest bridge.”

## 03. Mark Vincent Limpahan: Graph Model and Data, 5:25–7:30

### Divider and vertices, 5:25–5:55

[Show the graph-model divider, then the vertices slide. Hover a vertex if useful.] 

“We model the problem as the complete graph K10. Ten vertices give 45 undirected edges. Each location has a label, name, area, latitude, and longitude. Coordinates are used only for the divide step; costs come from the road-distance data.”

### Edges and matrix, 5:55–6:45

[Show the edges slide and hover a matrix cell.] 

“Each edge represents a whole road route, not a single street. A route can pass near another location without visiting it. For example, the V8-to-V0 edge passes near V2 on the map, but V2 is not visited a second time.

“The raw matrix is directed. For example, V0 to V1 and V1 to V0 have different OSRM distances. We define the undirected weight as one half of the two directed values, rounded to two decimal places. Hovering a matrix cell shows both directed values and their averaged weight.”

### Data sources and Google cross-check, 6:45–7:20

[Show the data-source slide, then the Google cross-check slide.] 

“The committed CSV files are the dataset of record because the public OSRM demo service and its OpenStreetMap data can change. We also cross-checked the final route against separate Google Maps driving searches.

“The matrix total is 13.82 kilometres and the Google comparison is 14.40 kilometres, a difference of about 4.2 percent. Individual legs differ by more because Google and OSRM use different map data, turn restrictions, and route choices. These Google values are a cross-check only; we do not replace the OSRM matrix or recompute the optimum from Google values.”

### Handoff to implementation, 7:20–7:30

[Leave the Google cross-check visible, then move to the applying-the-algorithm slide.]

“The data and the cross-check establish the input used by the program. Roxanne will now show how the algorithm runs on this graph and how we verify the resulting tour.”

## 04. Roxanne Locsin: Implementation and Results, 7:30–11:15

### Applying the algorithm, 7:30–8:10

[Show the divide tree and merge trace. Point to M1, M2, and the final merge.] 

“For seed 1, the algorithm repeatedly cuts the locations by longitude or latitude. The trace records each base case and merge. At each merge we can see the bridge, removed edges, added edges, change in length, and resulting cycle. This makes the numerical result reproducible and lets us explain exactly where the final ordering comes from.”

### Worked merge, 8:10–8:45

[Show the worked calculation.] 

“At the final merge, the program checks all cross pairs between the two halves to find the shortest bridge. It then selects the cheapest valid reconnection that keeps the paper-faithful bridge. The merge identity is L(T) equals L(T1) plus L(T2) plus delta, and the resulting cycle still visits every vertex once.”

### Step player: simple graph, 8:45–9:30

[Open the simple-graph player. Advance through input, shuffle, split, base, splice, merge, final, and verify.] 

“This player replays the recorded run on an abstract graph. First we see the ten input vertices and the shuffle. Then the recursive median cuts divide the set. The base cases create one- and two-city tours. During a splice, removed edges are shown separately from the bridge and closing edge that are added. At the end, the active sub-tours become one Hamiltonian cycle.”

### Step player: roads, 9:30–10:20

[Open the road-snapped player. Advance through one split and one merge, then show the final route.] 

“The second player places the same algorithm on the actual map. Each displayed edge follows the OSRM street geometry for that direction. The labels show the model weights used by the algorithm, which are the averaged undirected values. This connects the abstract graph operation to the actual road network.”

### Code and verification, 10:20–10:55

[Show the code components and live-demo slides.] 

“The main implementation is in `dc_tsp.py`. `split` chooses the axis and median, `solve` handles recursion, `shortest_bridge` finds the closest cross pair, and `merge` constructs a valid cycle. `verify.py` independently checks the start, end, number of entries, unique visits, and recomputed total.

“The recorded console output shows the input, every divide and merge, the route, verification checks, Held–Karp comparison, and the 100-seed experiment.”

### Resulting route, 10:55–11:15

[Show the route map and leg table.] 

“With seed 1 and the paper-faithful merge, the route is V0 to V1 to V7 to V9 to V2 to V3 to V4 to V5 to V6 to V8 and back to V0. Its symmetric-matrix length is 13.82 kilometres. Summing the raw one-way OSRM values in this driven direction gives 13.54 kilometres, showing the effect of averaging the two directions.”

## 05. Rhenel Jhon Sajol: Conclusion, 11:15–15:00

### Interpretation and M2, 11:15–12:25

[Show the route interpretation slide.] 

“The route satisfies the constraints: every landmark is visited once and the tour returns to USTP. The local Divisoria cluster is visited consecutively.

“The important difference from the optimum is the order inside that cluster. Merge M1 creates the triangle V3, V4, V5, whose length does not depend on the order. Merge M2 decides the order. Its shortest bridge is V6–V5, so the paper-faithful rule must include that edge. This produces the path V3 to V4 to V5. The optimal order would use V6–V4 instead. That alternative is not allowed by the shortest-bridge rule, but the best-splice variant can choose it. This is the local and irreversible decision that creates the 0.21-kilometre gap.”

### Optimality and 2-opt, 12:25–13:20

[Show the comparison slide. Toggle the optimal tour and the 2-opt fix.] 

“The exact Held–Karp computation gives an optimum of 13.61 kilometres. Therefore, the paper-faithful route is 1.54 percent longer and is an approximate solution.

“A single 2-opt move reverses the local V4-to-V5 ordering. It replaces V3–V4 and V5–V6 with V3–V5 and V4–V6, saving 0.21 kilometres and reaching exactly 13.61 kilometres. This is an improvement step, not part of the original Divide and Conquer algorithm.”

### Repeated runs and limitations, 13:20–14:15

[Show the seed chart and limitations slide.] 

“The paper reports 10 runs; we tested 100 seeds. With the paper-faithful rule, the lengths range from 13.61 to 14.26 kilometres, with only 6 of 100 runs reaching the optimum. The best-splice variant reaches the optimum more often, 17 times, but its mean is slightly worse at 13.91 kilometres compared with 13.88.

“Timing is about 0.3 milliseconds per run on this machine, but it varies by machine and run. Restarts alone do not prove optimality; Held–Karp is what tells us that the best route equals the optimum.”

## Closing, 14:15–15:00

[Show the final conclusion slide. Leave the route and totals visible.] 

“To conclude, we modelled a real downtown Cagayan de Oro tour as a TSP on K10, implemented Divide and Conquer in Python, corrected the paper’s invalid merge behavior, and verified the resulting route independently.

“The method is fast, geographically intuitive, and always produced a valid tour in our tests, but it is a heuristic. Its greedy merge decisions can lock in a locally inferior ordering. On our instance it produced 13.82 kilometres against the exact 13.61-kilometre optimum, while a simple 2-opt improvement closed the gap.

“Thank you for listening. We are ready for questions.”

## Timing Summary

| Segment | Time |
|---|---:|
| Heart Chiong | 3:45 |
| Mark Vincent Limpahan | 3:45 |
| Roxanne Locsin | 3:45 |
| Rhenel Jhon Sajol | 3:45 |
| **Total** | **15:00** |
