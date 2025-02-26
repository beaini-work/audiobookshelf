# TODO

## final stretch todo
- [ ] deploy 1 hr
- [ ] demo 1 hr
- [X] access transcript and summarization from row
- [X] view issue of summary not being refreshed. it does refresh, there's just lag. introduce spinner
- [ ] visualization of responses
- [ ] tondif git

## transcription

- [X] transcribe on download
- [X] add setting to transcribe on download
- [x] add config / setting to display transcript in player
- [x] setting for the size of the transcript

## search content

- [X] create new left navbar called Knowledge (rethink term later)
- [X] use chromadb with persistent storage for vector store
- [X] button to vectorize the content on demand
- [X] search the vector store. where in the UI?
- [X] automate vectorization of new content after transcription
- [X] vector store the content
- [X] openai key in docker deployment
- [ ] ability to check the episode summary from the KB search result

## view summary

- [X] Button to transcribe and summarize
- [X] clean up the summarize UI. specifically the header
- [X] Fix font color in view episode modal when text is selected (currently not visible)
- [X] Show transcript content directly in transcript tab instead of requiring button click
- [X] Improve CTA placement and design for Generate Summary and Transcribe buttons:
  - [X] Place buttons prominently in center of empty tab state
  - [X] Use consistent button styling and hierarchy
  - [X] Add clear visual feedback for button states (disabled, loading, etc)
  - [X] Include helpful empty state messaging
  - [X] Ensure adequate spacing and padding around buttons
  - [X] Use appropriate button variants to indicate primary/secondary actions
  - [ ] Remove "Test Knowledge"

## audio Q&A

- [ ] add prompt: only ask 1 question at a time about the most important segment
- [ ] add prompt: placeholders for voice, tone
- [ ] start it from player automatically and manually feature
- [ ] start it from episode row
- [ ] visualization of answers
- [ ] share the results

# else
- [X] 2nd brain
- [ ] deploy to AWS
- [ ] record demo

## finissage

- [ ] tutorial intro


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

- [ ] rename project to something e.g. audiobrain
- [X] use openai for transcription
- [ ] display suggested questions to ask in the knowledge base
- [ ] change chromadb credentials
- [ ] update table name of summaries. inconsistent naming pattern
- [ ] remove chromadb server init check cause it's not working
- [ ] notify front end when transcription is complete
- [ ] clicking transcript syncs to that time
- [ ] use tokenizer to split transcript into chunks for vectorization
- [ ] Add progress tracking for the summary generation process?
- [ ] check if can transcript on this server before turning it on
- [ ] ability to configure the summaries
