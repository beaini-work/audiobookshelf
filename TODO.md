# TODO

## transcription

- [ ] transcribe on download
- [ ] add setting to transcribe on download
- [x] add config / setting to display transcript in player
- [x] setting for the size of the transcript
- [ ] check if can transcript on this server before turning it on

## search content

- [X] create new left navbar called Knowledge (rethink term later)
- [X] use chromadb with persistent storage for vector store
- [X] button to vectorize the content on demand
- [X] search the vector store. where in the UI?
- [ ] automate vectorization of new content
- [X] vector store the content
- [X] openai key in docker deployment
- [ ] ability to configure the summaries
- [ ] ability to check the episode summary from the KB search result

## view summary

- [ ] Button to transcribe and summarize
- [ ] Display summaries in the Knowledge section
- [ ] clean up the summarize UI
- [ ] Fix font color in view episode modal when text is selected (currently not visible)
- [ ] Show transcript content directly in transcript tab instead of requiring button click
- [ ] Improve CTA placement and design for Generate Summary and Transcribe buttons:
  - [ ] Place buttons prominently in center of empty tab state
  - [ ] Use consistent button styling and hierarchy
  - [ ] Add clear visual feedback for button states (disabled, loading, etc)
  - [ ] Include helpful empty state messaging
  - [ ] Ensure adequate spacing and padding around buttons
  - [ ] Use appropriate button variants to indicate primary/secondary actions

## finissage

- [ ] tutorial intro

## audio Q&A

# fixes

- [ ] can click transcribe multiple time to file that's queued
- [ ] can view the non-exitent transcipt before it's done
<<<<<<< HEAD
- [ ]
- [  transcribe on download
- [ ] add setting to transcribe on download
- [ ] add config / setting to display transcript in player
- [ ] setting for the size of the transcript
- [X] add config / setting to display transcript in player
- [X] setting for the size of the transcript
- [ ] check if can transcript on this server before turning it on
- [ ] clicking transcript syncs to that time

## search content

## view summary
- [ ] summarize

## audio Q&A

# fixes
- [ ] can click transcribe multiple time to file that's queued
- [ ] can view the non-exitent transcipt before it's done
=======
>>>>>>> 9b459567 (todo updates)
- [ ] 

# highly optional todos

- [ ] display suggested questions to ask in the knowledge base
- [ ] change chromadb credentials
- [ ] update table name of summaries. inconsistent naming pattern
- [ ] remove chromadb server init check cause it's not working
- [ ] notify front end when transcription is complete
- [ ] clicking transcript syncs to that time
- [ ] use tokenizer to split transcript into chunks for vectorization
- [ ] Add progress tracking for the summary generation process?
