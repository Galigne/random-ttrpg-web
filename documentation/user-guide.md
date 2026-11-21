# Website user guide

## Campaigns and sheets

Create a campaign or accept an invitation. The creator is both Owner and GM. Ownership and GM membership are separate roles. Use **Members** to invite existing users and manage campaign roles.

In **Characters** or **Creatures**, create a blank sheet or review a generated preview before saving. New sheets are private. The owner can grant named users viewer or editor access and request assignments to multiple campaigns. A GM in each destination campaign approves the request. A campaign link or ID lets a sheet owner request an assignment without joining the campaign. Choose visibility separately for each assignment.

In **Members**, select an eligible assigned character as your **Playing Character**. Campaign members can see its limited preview even when the full sheet is private. The full sheet and its activity follow the applicable sheet and campaign permissions.

## Running a battle

Open your campaign's **Overview** and find **Battle**. A GM or site administrator can choose **Start battle**. This adds the eligible Playing Characters of members currently present in the workspace who can edit those sheets. Use **Add combatant** to add other approved campaign characters or creatures. Manually added combatants enter the enemy side of the tracker.

The tracker groups combatants by Speed and side. Higher Speed goes first, with the player side ahead on ties. Combatants in the active group can act in any order. Select a combatant to see the controls you can use.

- **End turn** marks that combatant finished, refills Movement Distance (MD), and sets current Action Points (AP) to the maximum plus half the remaining AP, rounded down. When everyone in the active group finishes, the tracker advances automatically.
- **Delay** moves an unfinished combatant past the next group in the current round. It is unavailable for the last group. At the next round, delayed combatants return to their normal groups and finished markers reset.
- A GM or site administrator can **Advance** to the next group without applying end-turn recovery, **Move earlier** or **Move later** to reorder groups, or **Set active** to correct which group is acting. Setting a group active clears its finished markers while preserving whether combatants have already recovered resources this round. GMs and site administrators can also remove combatants and choose **End battle**.

Players can finish or delay the turn of their own Playing Character when they have edit access to that sheet and it is their character's turn. GMs and site administrators can control any approved campaign combatant. If a member cannot see a combatant's identity, the tracker displays **Unknown combatant**.

## Damage, healing, and resources

In **Battle → Resources**, use **Select a target** or click a controllable combatant. You can use this panel before starting a battle. GMs and site administrators can target any approved campaign character or creature. Other members can target their own Playing Character when they have edit access.

| Action | Effect |
| --- | --- |
| **Damage** | Subtract a positive whole number from current Armor Rating (AR) first, then from Hit Points (HP). Check **Piercing** to apply damage directly to HP. |
| **Heal** | Add a positive whole number to HP, AR, or both. Healing stops at the maximum and leaves an already overfull resource intact. |
| **Restore** | Set HP, AR, or both to a percentage of each maximum. This sets a value and can lower the current amount. |
| **Set resource** | Choose a current HP, AR, AP, or MD value. Click a resource meter to select it directly. Maximums are edited on the full sheet. |

Resource actions save to the sheet and its history immediately. Finish any active sheet edit before changing resources or ending that combatant's turn through the battle panel. The panel respects exclusive editing locks, including for GMs.

Open the full sheet to edit its fields or use its own combat controls. Start an exclusive edit first. Opening a sheet from a campaign lets eligible combat events appear there. Opening it from the library keeps combat events personal. Choosing a level saves immediately. Other edits save when you leave the section or choose **Save**. **Undo** and **Redo** show a preview until you save it. A disconnected or inactive editor can lose the lock and any unsaved draft.

Battle order and chat live in the workspace. They disappear on server restart or five minutes after the last member leaves. Saved resource changes and sheet history persist.

## Dice, images, and languages

The **Dice** page is private and saves your texture and glow. In a campaign, rolls can be public or private to you and the GMs. For a D4, read the tip. For a D100, tens are on the left and units on the right. 00 and 0 represent 100. On a D20, 1 is a critical success and 20 is a critical failure. Both have a five-second reveal. Reduced motion softens critical effects and shows ordinary results immediately.

Portraits and campaign covers accept PNG, JPEG, or WebP up to 4 MiB and 32 million pixels, with a maximum of 8192 pixels per dimension. The website and rulebooks are available in English and French. Changing the interface language leaves previously generated sheet text in its original language.

For account setup and invitations, see the [README](../README.md).
