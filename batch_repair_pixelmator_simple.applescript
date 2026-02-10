-- ============================================================
-- Batch Repair with Mask — Pixelmator Pro (Simple Version)
-- ============================================================
-- Uses folder picker dialogs so you don't have to edit paths.
-- Applies the mask as a selection and inpaints each image.
--
-- HOW TO RUN:
--   1. Open Script Editor (Applications > Utilities > Script Editor)
--   2. Paste this script and click Run
--   3. Select your folders/files when prompted
--
--   OR from Terminal:
--     osascript batch_repair_pixelmator_simple.applescript
-- ============================================================

-- Ask user to pick folders and mask
set inputFolder to choose folder with prompt "Select the folder with your source images:"
set outputFolder to choose folder with prompt "Select the output folder for JPGs:"
set maskFile to choose file with prompt "Select your mask image (white = area to repair):" of type {"public.image"}

-- JPG quality
set jpegQuality to 85

-- Get output folder as POSIX path
set outputFolderPath to POSIX path of outputFolder

-- Collect image files
tell application "Finder"
	set imageFiles to (every file of inputFolder whose name extension is in {"png", "jpg", "jpeg", "tiff", "tif", "heic", "bmp"}) as alias list
end tell

set totalFiles to count of imageFiles
if totalFiles = 0 then
	display dialog "No image files found in the selected folder." buttons {"OK"} default button "OK"
	return
end if

display dialog "Ready to process " & totalFiles & " images." & return & return & "This will:" & return & "  1. Open each image in Pixelmator Pro" & return & "  2. Apply the mask and repair (inpaint)" & return & "  3. Save as JPG to your output folder" & return & return & "Pixelmator Pro must stay in the foreground." buttons {"Cancel", "Start"} default button "Start"

set processedCount to 0
set failedFiles to {}

tell application "Pixelmator Pro"
	activate
	delay 1
end tell

repeat with imageFile in imageFiles
	set processedCount to processedCount + 1

	-- Get file name
	tell application "System Events"
		set fileName to name of imageFile
	end tell

	-- Build output file name (.jpg)
	set dotPos to 0
	repeat with i from (length of fileName) to 1 by -1
		if character i of fileName = "." then
			set dotPos to i
			exit repeat
		end if
	end repeat
	if dotPos > 0 then
		set baseName to text 1 thru (dotPos - 1) of fileName
	else
		set baseName to fileName
	end if
	set outputPath to outputFolderPath & baseName & ".jpg"

	try
		tell application "Pixelmator Pro"
			-- Open the image
			open imageFile
			delay 1.5

			set currentDoc to front document

			-- Open mask and copy
			open maskFile
			delay 1
			tell front document
				select all
				copy
			end tell
			close front document without saving
			delay 0.5

			-- Paste mask into the source image
			tell currentDoc
				paste
			end tell
			delay 0.5
		end tell

		-- UI scripting: load selection from mask layer, delete mask layer, inpaint
		tell application "System Events"
			tell process "Pixelmator Pro"
				set frontmost to true
				delay 0.3

				-- Try to load the mask layer as a selection
				-- Navigate: Edit menu
				try
					click menu item "Load Selection" of menu "Edit" of menu bar 1
					delay 1
				on error
					-- Try alternate path
					try
						-- Use keyboard shortcut if available
						-- Or use Select > Load Selection
						click menu item "Load Selection" of menu "Select" of menu bar 1
						delay 1
					end try
				end try

				-- Delete the mask layer (keep the selection)
				-- Press Delete to remove the mask layer content/layer
				try
					-- Use Layer > Delete Layer
					click menu item "Delete" of menu "Layer" of menu bar 1
					delay 0.3
				on error
					try
						key code 51 -- Delete key
						delay 0.3
					end try
				end try

				-- Flatten to make sure we're on the original layer
				try
					click menu item "Flatten Image" of menu "Image" of menu bar 1
					delay 0.5
				on error
					try
						click menu item "Flatten Image" of menu "Layer" of menu bar 1
						delay 0.5
					end try
				end try

				-- Apply Inpaint on the selection
				try
					click menu item "Inpaint" of menu "Format" of menu bar 1
					delay 3
				on error
					try
						click menu item "Inpaint" of menu "Image" of menu bar 1
						delay 3
					on error
						try
							click menu item "Inpaint" of menu "Edit" of menu bar 1
							delay 3
						end try
					end try
				end try
			end tell
		end tell

		-- Deselect and export
		tell application "Pixelmator Pro"
			tell its front document
				try
					deselect
				end try
				export to file (POSIX file outputPath) as JPEG with properties {compression factor:jpegQuality}
			end tell
			close front document without saving
		end tell

		delay 0.3

	on error errMsg
		set end of failedFiles to fileName & " (" & errMsg & ")"
		-- Try to close any open documents
		try
			tell application "Pixelmator Pro"
				close front document without saving
			end tell
		end try
	end try

	-- Log progress
	log "✓ " & processedCount & "/" & totalFiles & ": " & fileName
end repeat

-- Summary
set summaryMsg to "Done! Processed " & processedCount & " of " & totalFiles & " images."
if (count of failedFiles) > 0 then
	set summaryMsg to summaryMsg & return & return & "Failed files:"
	repeat with f in failedFiles
		set summaryMsg to summaryMsg & return & "  - " & f
	end repeat
end if

display dialog summaryMsg buttons {"OK"} default button "OK" with title "Batch Repair Complete"
