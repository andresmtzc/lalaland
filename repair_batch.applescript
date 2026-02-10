-- Batch Image Repair using Pixelmator Pro
-- Uses a single mask for all images in a folder
-- Output: same folder, with "_repaired" suffix
--
-- BEFORE RUNNING:
--   1. System Settings > Privacy & Security > Accessibility → enable Script Editor (or Terminal)
--   2. Run: osascript repair_batch.applescript

-- Pick folder and mask
set imageFolder to choose folder with prompt "Select the folder with images to repair:"
set maskFile to choose file with prompt "Select the mask PNG (used for all images):" of type {"public.image"}

-- Find all JPG/JPEG files
set imageList to do shell script "ls " & quoted form of POSIX path of imageFolder & " | grep -iE '\\.(jpg|jpeg)$'"
set imageNames to paragraphs of imageList
set totalCount to count of imageNames

-- Choose how many to process
set modeChoice to button returned of (display dialog "Found " & totalCount & " images." & return & return & "Process all, or test with a few first?" buttons {"Cancel", "Test First", "All"} default button "All")

set processCount to totalCount
if modeChoice is "Test First" then
	set testInput to text returned of (display dialog "How many images to process?" default answer "3")
	set processCount to testInput as integer
	if processCount > totalCount then set processCount to totalCount
end if

tell application "Pixelmator Pro" to activate
delay 0.5

-- Copy mask to clipboard once
tell application "Pixelmator Pro"
	open maskFile
	delay 0.5
	tell front document
		select all
		copy
	end tell
	close front document without saving
end tell

set processedCount to 0

repeat with i from 1 to processCount
	set imageName to item i of imageNames
	set imagePath to POSIX path of imageFolder & imageName

	-- Build export path with _repaired suffix
	set AppleScript's text item delimiters to "."
	set nameParts to text items of imageName
	set ext to last item of nameParts
	set baseName to (items 1 thru -2 of nameParts) as text
	set AppleScript's text item delimiters to ""
	set exportPath to POSIX path of imageFolder & baseName & "_repaired." & ext

	-- Step 1: Open the image
	tell application "Pixelmator Pro"
		open POSIX file imagePath as alias
		delay 1
	end tell

	-- Step 2: Paste mask as a new layer (already in clipboard)
	tell application "Pixelmator Pro"
		tell front document
			paste
		end tell
		delay 0.5
	end tell

	-- Step 3: Load Selection from mask layer
	tell application "System Events"
		tell process "Pixelmator Pro"
			set frontmost to true
			delay 0.3
			click menu item "Load Selection" of menu "Edit" of menu bar 1
			delay 0.5
		end tell
	end tell

	-- Step 4: Select the image layer (bottom layer)
	tell application "Pixelmator Pro"
		tell front document
			set current layer to last layer
		end tell
		delay 0.3
	end tell

	-- Step 5: Select the Repair tool
	tell application "System Events"
		tell process "Pixelmator Pro"
			keystroke "r"
			delay 0.5
		end tell
	end tell

	-- Step 6: Click "Repair Selection"
	tell application "System Events"
		tell process "Pixelmator Pro"
			click button "Repair Selection" of group 1 of group 2 of window 1
			delay 2
		end tell
	end tell

	-- Step 7: Deselect
	tell application "Pixelmator Pro"
		tell front document
			deselect
		end tell
	end tell

	-- Step 8: Hide mask layer and export
	set exportFile to POSIX file exportPath
	tell application "Pixelmator Pro"
		tell front document
			set visible of layer 1 to false
		end tell
		delay 0.3
		if ext is "jpg" or ext is "jpeg" or ext is "JPG" or ext is "JPEG" then
			export front document to exportFile as JPEG
		else
			export front document to exportFile as PNG
		end if
		delay 0.5
		close front document without saving
	end tell

	-- Recompress JPEG
	if ext is "jpg" or ext is "jpeg" or ext is "JPG" or ext is "JPEG" then
		do shell script "sips -s formatOptions 75 " & quoted form of exportPath
	end if

	set processedCount to processedCount + 1
end repeat

display dialog "Done! Processed " & processedCount & " of " & totalCount & " images." buttons {"OK"} default button "OK"
