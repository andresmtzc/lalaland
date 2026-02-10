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

-- Step 4: Delete the mask layer (selection stays active)
tell application "System Events"
	tell process "Pixelmator Pro"
		-- Edit > Delete or backspace to remove the mask layer
		key code 51 -- backspace
		delay 0.3
	end tell
end tell

-- Step 5: Select the Repair tool
tell application "System Events"
	tell process "Pixelmator Pro"
		keystroke "r"
		delay 0.5
	end tell
end tell

-- Step 6: Dump the UI hierarchy to find the "Repair Selection" button
-- No Accessibility Inspector needed — this writes to a file on your Desktop
tell application "System Events"
	tell process "Pixelmator Pro"
		set frontmost to true
		delay 0.3

		-- Walk the entire window and collect every UI element's role + name
		set uiDump to ""
		set win to window 1
		set uiDump to my dumpElements(win, 0)
	end tell
end tell

-- Write the dump to Desktop so you can send it to me
set dumpPath to (POSIX path of (path to desktop)) & "pixelmator_ui_dump.txt"
do shell script "echo " & quoted form of uiDump & " > " & quoted form of dumpPath

display dialog "UI dump saved to:" & return & dumpPath & return & return & "Send me the contents of that file and I'll wire up the last step." buttons {"OK"} default button "OK"

-- Helper: recursively dump UI element tree
on dumpElements(parentElement, depth)
	set indent to ""
	repeat depth times
		set indent to indent & "  "
	end repeat

	set output to ""
	tell application "System Events"
		try
			set elemRole to role of parentElement
		on error
			set elemRole to "?"
		end try
		try
			set elemName to name of parentElement
		on error
			set elemName to ""
		end try
		try
			set elemDesc to description of parentElement
		on error
			set elemDesc to ""
		end try

		set output to output & indent & elemRole & " | " & elemName & " | " & elemDesc & "
"

		try
			set childElements to UI elements of parentElement
			repeat with child in childElements
				set output to output & my dumpElements(child, depth + 1)
			end repeat
		end try
	end tell
	return output
end dumpElements
