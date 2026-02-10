-- Single Image Repair — Proof of Concept
-- Flow: open image → add mask layer → load selection → delete mask → repair selection
--
-- BEFORE RUNNING:
--   1. System Settings > Privacy & Security > Accessibility → enable Script Editor (or Terminal)
--   2. Run: osascript repair_proof.applescript

-- Pick files
set imageFile to choose file with prompt "Select the image to repair:" of type {"public.image"}
set maskFile to choose file with prompt "Select the mask PNG (transparent = keep, opaque = repair):" of type {"public.image"}

-- Step 1: Open the image
tell application "Pixelmator Pro"
	activate
	open imageFile
	delay 1
end tell

-- Step 2: Add mask as a new layer (open, copy, paste approach)
tell application "Pixelmator Pro"
	open maskFile
	delay 0.5
	tell front document
		select all
		copy
	end tell
	close front document without saving
	delay 0.3
	-- Paste into the original image — creates a new layer
	tell front document
		paste
	end tell
	delay 0.5
end tell

-- Step 3: Load Selection from the mask layer (alpha/transparency)
tell application "System Events"
	tell process "Pixelmator Pro"
		set frontmost to true
		delay 0.3
		click menu item "Load Selection" of menu "Edit" of menu bar 1
		delay 0.5
	end tell
end tell

-- Step 4: Dump Arrange menu items to find the layer delete command
tell application "System Events"
	tell process "Pixelmator Pro"
		set arrangeItems to name of every menu item of menu "Arrange" of menu bar 1
	end tell
end tell
set itemList to ""
repeat with i in arrangeItems
	if i is not missing value then
		set itemList to itemList & i & return
	end if
end repeat
display dialog "Arrange menu items:" & return & itemList buttons {"OK"} default button "OK"
return -- stop here

-- Step 5: Select the Repair tool
tell application "System Events"
	tell process "Pixelmator Pro"
		keystroke "r"
		delay 0.5
	end tell
end tell

-- Step 6: Click "Repair Selection" in the tool options panel
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

display dialog "Done! Check the result in Pixelmator Pro." buttons {"OK"} default button "OK"
