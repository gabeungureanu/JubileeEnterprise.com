Capacity Calculation Instructions (Paragraph Format)

Begin by selecting the Inspire Family collection from the PostgreSQL collections table and resolving its unique collection_id. All calculations must be scoped strictly to this collection so the results are deterministic and reusable for other collections later.

Next, traverse the entire category hierarchy associated with this collection by querying the collection_categories table. You must retrieve every category and subcategory linked to the Inspire Family collection, following parent–child relationships to unlimited depth. This step establishes the full structural scope of content that belongs to the collection.

After loading the category tree, query the table that stores category-level content items, such as instructions, prompts, rules, or properties. Retrieve all items associated with the Inspire Family collection. For each item, examine its declared type and classify it into one—and only one—of the following functional groups: Executable Units, Event-Reactive Units, Reference Units, or Governance Units. Executable Units include activation logic and instructions intended to run during persona or family activation. Event-Reactive Units include conditional logic that responds to triggers or situations. Reference Units include descriptive or informational content such as properties, guidelines, or behavioral definitions. Governance Units include guardrails, enforcement rules, ethical constraints, and authority boundaries.

Once all items have been classified, calculate the raw capacity values by counting how many items fall into each functional group. You then compute Total Vectors by summing the counts of Executable Units, Event-Reactive Units, Reference Units, and Governance Units. Each stored item is assumed to produce at least one vector in Qdrant, so no deduplication is performed at this stage.

Optionally, apply predictive expansion multipliers to better estimate real-world vector usage after embedding. Multiply Executable Units by 1.2, Event-Reactive Units by 1.3, Reference Units by 1.0, and Governance Units by 1.1. This produces an Expanded Vector Estimate, which should be clearly labeled as a projection rather than a raw count.

Finally, persist the calculated metrics into a dedicated PostgreSQL table such as collection_capacity_metrics, including the collection identifier, timestamp, individual unit counts, raw total vectors, expanded vector estimate (if used), and a calculation version. This allows future comparisons, trend tracking, and recalculation when content changes. These same steps must be reusable for any other collection by changing only the collection_id.

Final Output Grid (Example)
Metric Type	Count
Executable Units	128
Event-Reactive Units	64
Reference Units	412
Governance Units	96
Total Vectors (Raw)	700
Expanded Estimate	842

This grid is the expected final output of the process. It gives you a tangible, comparable measure of how much functional capacity and vector weight the Inspire Family collection represents relative to other collections in the system.

Now given this data how many total possible combinations exist between the various objects that can be executed. Persent these results in the following format (example): 

Summary
Scope	Combinations
Minimal (exec × triggers)	188
Moderate (with avg references)	~3.76 billion
Theoretical maximum	~2.22 × 10²³
The expanded estimate of 190.30 vectors represents the weighted capacity for embedding/retrieval, not the combinatorial execution space. The actual runtime behavior depends on which items are activated together in a given context.
