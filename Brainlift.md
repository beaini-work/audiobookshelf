I want you to produce a brainlift (see template below) around this project. I will be taking audiobookshelf open source project and extending it by adding a few main features: transcribing podcasts, summarizing podcasts, Q&A your podcasta, and knowledge testing a podcast to help in retention of information DOK1 (Depth of Knowledge level 1). The driving hypothesis is that people do not need more new content, but need to retain existing content. Similar to an education system, people need to DOK1 at least existing concepts before moving on to new ones. it's an arrow in the other direction of TikTok. So the goal is maximize the knowledge gathering and retention from podcasts. The content of this brainlift is for the project team and stakeholders to understand and communicate what to build, why build it.

YOUR ANSWER SHOULD BE FORMATTED IN BULLET POINT FORMAT AS DESCRIBED IN THE TEMPLATE AT THE END. TEMPLATE IS FLEXIBLE, START WITH THE FORMAT BELOW BUT TWEAK IF NECESSARY. be as detailed as necessary in the brainlift.

note that the target market is podcast listeners. it can be divided into sub segments though - focus on behaviour segmentation.


Implementation details should be integrated in its own section in the brainlift. Here's the work that's been implemented:
1. As a podcast listener, I want to quickly access AI-powered tools for a specific episode directly from the episode list, so that I can easily interact with AI features without navigating to a separate page.

    Implementation Details: To streamline access to AI features, we've added a new "AI Knowledge Tools" button directly to each podcast episode row in the episode list view. This button is represented by a brain icon (<span class="material-symbols">psychology</span>) for easy recognition of AI-related functionalities. Clicking this button will now open a dropdown menu right there in the episode row, providing immediate access to key AI actions.

    Dropdown Menu Options: The "AI Knowledge Tools" menu contains the following contextually relevant actions:

        View Transcript / Generate Transcript: This option intelligently adapts based on whether a transcript already exists for the episode. If a transcript is available, it will be labeled "View Transcript" and will open the existing Transcript Modal. If a transcript hasn't been generated yet, it will display "Generate Transcript" and initiate the transcription process when selected.

        View Summary / Generate Summary: Similar to the transcript option, this menu item adapts to the episode's summary status. "View Summary" will display if a summary is available, opening the episode view modal to the summary tab. "Generate Summary" will initiate the summary generation process if one doesn't exist.

        Test my knowledge: This new option allows users to directly jump into a knowledge quiz based on the selected podcast episode, providing a quick way to engage with the content on a deeper level.

    Design Considerations: This dropdown menu placement is designed to improve user workflow by reducing clicks and navigation steps needed to engage with AI features. By embedding these actions directly within the episode list, users can discover and utilize AI tools more intuitively, enhancing the overall user experience.

2. As a podcast listener interested in transcripts, I want to be able to view or generate a transcript for an episode directly from the episode list, so that I can quickly access transcripts without opening the episode details.

    Implementation Details: Within the newly implemented "AI Knowledge Tools" dropdown menu, the "View Transcript / Generate Transcript" action provides direct access to transcript functionality.

    "View Transcript" Action: If a transcript is already available for the selected episode, choosing this option will immediately open the existing Transcript Modal. This allows users to quickly review the episode's transcript without needing to navigate to the full episode details view first.

    "Generate Transcript" Action: If a transcript does not yet exist, selecting "Generate Transcript" from the dropdown will initiate the transcription process in the background. Users will be notified of the transcription status through the standard notification system, and the "AI Knowledge Tools" menu will update accordingly once the transcript is available.

    Design Considerations: This direct access point for transcripts aims to significantly reduce the effort required for users who frequently utilize transcripts for content review or accessibility. By placing this action prominently in the episode list, we make transcripts a more discoverable and easily accessible feature.

3. As a podcast listener interested in summaries, I want to be able to view or generate a summary for an episode directly from the episode list, so that I can quickly get a summary without opening the episode details.

    Implementation Details: Similar to transcripts, the "AI Knowledge Tools" dropdown provides a "View Summary / Generate Summary" action for immediate access to episode summaries.

    "View Summary" Action: If a summary has already been generated for the episode, selecting "View Summary" will open the episode details modal and directly navigate the user to the "Summary" tab. This provides a shortcut to view the summary content.

    "Generate Summary" Action: If a summary is not yet available, selecting "Generate Summary" will start the summary generation process in the background. Users will be notified when the summary is ready, and the "AI Knowledge Tools" menu will reflect the updated summary status.

    Design Considerations: This streamlined access to summaries directly from the episode list is intended to make it easier for users to quickly grasp the main points of an episode before or after listening. This improves content discovery and helps users efficiently manage their listening time.

4. As a podcast listener who wants to test my understanding of an episode, I want to be able to start a knowledge quiz directly from the episode list, so that I can easily test my comprehension after listening.

    Implementation Details: The "AI Knowledge Tools" dropdown introduces a new "Test my knowledge" action. Selecting this option will directly launch the Voice Chat Modal, now repurposed as a "Podcast Knowledge Quiz" modal.

    Knowledge Quiz Modal: Upon initiating the quiz from the episode list, the Voice Chat Modal will open and be pre-configured to focus on the selected episode. The modal is designed to facilitate a conversational quiz format, where users can ask questions and receive feedback to test their understanding of the episode's content. The modal UI provides controls for starting the quiz session, recording voice input, and viewing the conversation history.

    Design Considerations: This feature provides a novel and engaging way for users to interact with podcast content beyond passive listening. By integrating the knowledge quiz directly into the episode browsing experience, we encourage active learning and deeper engagement with the audio content.

5. As a user, I want the AI Knowledge Tools dropdown menu to be visually appealing and well-placed in the UI, so that the application is user-friendly and easy to navigate.

    Implementation Details: The "AI Knowledge Tools" dropdown menu is implemented using the reusable ui-context-menu-dropdown component. This ensures consistency with existing UI patterns and provides a familiar interaction model for users.

    Visual Styling: The dropdown button is designed to be visually distinct but not intrusive, using a psychology icon and subtle hover effects. The menu itself is styled with a modern, dark theme that aligns with the application's overall aesthetic. Menu items are designed with clear icons and text labels for easy scanning and selection.

    Dynamic Positioning: To ensure optimal usability, particularly within tables that may scroll, the dropdown menu is implemented with dynamic positioning logic. This ensures that the menu is always fully visible within the viewport, even when triggered from episode rows near the bottom of the screen. This is achieved by dynamically calculating the menu's position based on the button's location and the viewport boundaries, utilizing CSS properties like z-index and position: fixed to maintain proper layering and prevent clipping.

    Design Considerations: The design of the dropdown menu prioritizes usability and visual harmony within the application. The dynamic positioning logic ensures a consistent and predictable user experience regardless of the user's scroll position or screen size. The visual styling is designed to be both informative and aesthetically pleasing, contributing to a polished and professional user interface.



sources to get started:
- https://www.youtube.com/watch?v=ddq8JIMhz7c
- check hubermanlab podcast and his sources for references 


QUESTIONS TO ANSWER IN THIS DEEP RESEARCH:
- Who is the target customer?
- what problem are we solving?
- data to build that hypothesis
- what others are doing
- how we are different
- biggest risks
- constraints for MVP


Template - Layout of the BrainLift Structure and Examples

    Name of BrainLift (e.g. Cognitive Load Theory BrainLift)
        There is a Purpose, a set of Experts, a set of Sources, a Knowledge Tree / set of Categories of sources, Insights, and SpikyPOVs
        Purpose
            the reason for this BrainLift
            how it will be used
            what is in scope and not in scope in this BrainLift
                only include scope statements if you have concrete examples of things in scope and out of scope that are important to highlight.  leave scope statements out until you have important examples.
        Experts
            List the experts in the domain of this BrainLift.  These are the people that you will follow voraciously to become an expert yourself.
            Experts - Experts are people or organizations or websites or mailing lists that should be followed because they produce Sources (tweets, blog posts, articles, papers, books). Creating lists of experts is DOK1
                the experts list can be used to "filter the internet" to just materials produced by experts in the field.
                humans can create expert lists by asking perplexity, searching twitter, find like posts, and following links.
                the expert list is the most foundational part of a BrainLift on which everything else is based.
            Each expert entry will include who the expert is, what their main views are, why you are following them, and the main places ephor can look to find them online.
            In the experts section, do not include analysis of their sources, just list them for Ephor.  You can organize their analyzed sources in the Knowledge Tree
            you can start organizing experts into categories when the list of experts becomes hard to manage without them.
            Expert Template - Expert 1
                who: titles and "claims to fame"
                focus: topics they are expert in
                why follow: main views of the expert and how they are valuable for this BrainLift
                where: how to find the expert on the internet - twitter handle, blog, books, papers, written
            Example Expert - Andrew Ng 
                AI Education and Research
                Who: Co-founder of Coursera, Adjunct Professor at Stanford, former Chief Scientist at Baidu.
                Focus: AI, Machine Learning, and AI education.
                Why Follow: While somewhat generic, Andrew Ng is one of the most influential voices in AI and is known for making AI more accessible to non-experts. He frequently discusses how AI can be applied across various domains, including product management. 
                Where: Twitter @AndrewYNg, LinkedIn, deeplearning.ai.
            Example Expert - Justin Skycak
                Who: "Chief Quant" at mathacademy
                Focus: Teaching math efficiently
                Why Follow: believes that kids can learn math 4x faster when math curriuclum is broken down into bite-sized pieces and presented to students at the right times. has great insights not just about learning science, but how to apply it to building a efficient math teaching edtech app, mathacademy. 
                Where: 
                    Book the 'math academy way' 
                    https://www.justinmath.com/
                    twitter - @justinskycak 
            Example Expert - Dr. Kimberly Berens 
            Example Expert - Siegfried "Zig" Engelmann
        Knowledge Tree / Categories
            Knowledge categories are how you subdivide the domain of the Brainlift into sub topics.  
                Categorizing and summarizing sets of source materials into a coherent and easy to understand knowledge tree is DOK 2
                    DOK Level 2: Skills and Concepts
                        Tasks require engagement with methods or concepts.
                        Involves reasoning, organizing, and summarizing information.
            A Category is a summary, a set of subcategories or set of sources, and a set of optional insights. 
            Sources
                Sources are primary source documents.  Creating source material entries by reading source materials, pulling out important facts and filling out forms requires only the recall and reproduction of DOK 1
                    Sources can be books, papers, articles, tweets, blog posts, diagrams, apps, tools, websites
                    DOK Level 1: Recall and Reproduction
                        Tasks require recall of facts or procedures.
                        Involves following straightforward steps or instructions.
                sources have facts, summary, a link, and optional insights
                Example Source - Ms. Sam @sciinthemaking on teaching science w/ inquiry learning
                    facts
                    summary
                        a common misconception is that students should learn science by inquiry learning because that is what expert scientists do, but scientists are experts (not novices), and students are novices and novices need direct explicit instruction.  
                    link
                    insights
                        the misconception "science should be taught with inquiry learning" is an example of the expertise reversal effect
                Example Source - WHAT WE ALREADY KNOW DETERMINES WHAT, HOW, AND HOW WELL WE LEARN - Paul A. Kirschner & Mirjam Neelen
                    facts
                    summary
                    link
                    insights
            Insights
                Insights are surprising, contrarian, or new learnings. They can come from going deep into a domain with a fresh perspective or from drawing a logical conclusion from one or more sources or categories.
                optional Insights can be added at each level of the BrainLift hierarchy: on a category, subcategory, or an individual source
                Generating insights by creating frameworks and comparing and contrasting different points of view requires the strategic thinking of DOK 3. 
                    DOK Level 3: Strategic Thinking
                        Tasks involve reasoning, planning, and using evidence.
                        Requires higher-order thinking skills and decision-making.
            Categories can be overlapping. 
                source documents may be under two different categories
                Use links, NOT mirroring, to avoid cutting and pasting and to keep the workflowy simple (mirrors lack a clear "master" location and make BrainLifts too busy).
            Template Knowledge Tree / Categories
                Category 1  
                    Summary
                    Sources
                        Template Source - Source 1 Name
                            summary 
                                summary 
                                list of important facts
                            link
                                link to the source
                            insights - optional
