#!/usr/bin/env python3
"""Generate a signed iOS Shortcut for Genesis GV70 remote commands."""

import plistlib
import subprocess
import os
import uuid

API_URL_PLACEHOLDER = "https://genesis-sms.vercel.app/api/command"
API_KEY = "a0e11bfb4297c76bacee845ac51e878d471733531dcad30c42f258e09ba61554"
PIN = "1249"

# Menu label → API command
MENU_ITEMS = {
    "Start": "start",
    "Start (Winter)": "start-winter",
    "Start (Summer)": "start-summer",
    "Stop": "stop",
    "Lock": "lock",
    "Unlock": "unlock",
    "Status": "status",
}


def make_text_token(value):
    return {
        "Value": {"string": value},
        "WFSerializationType": "WFTextTokenString",
    }


def make_dict_field(key, value, item_type=0):
    return {
        "WFItemType": item_type,
        "WFKey": make_text_token(key),
        "WFValue": make_text_token(value),
    }


def make_dictionary_value(items):
    return {
        "Value": {"WFDictionaryFieldValueItems": items},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def make_output_ref(output_uuid, output_name):
    return {
        "Value": {
            "attachmentsByRange": {
                "{0, 1}": {
                    "OutputName": output_name,
                    "OutputUUID": output_uuid,
                    "Type": "ActionOutput",
                }
            },
            "string": "\ufffc",
        },
        "WFSerializationType": "WFTextTokenString",
    }


def build_menu_shortcut(api_url, api_key, pin):
    """Build a single shortcut with a menu for all commands."""

    menu_uuid = str(uuid.uuid4()).upper()
    labels = list(MENU_ITEMS.keys())
    url_uuids = {label: str(uuid.uuid4()).upper() for label in labels}
    dict_uuids = {label: str(uuid.uuid4()).upper() for label in labels}

    actions = []

    # Menu start
    actions.append(
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": menu_uuid,
                "WFControlFlowMode": 0,
                "WFMenuPrompt": "GV70 Command",
                "WFMenuItems": labels,
            },
        }
    )

    # Each menu item
    for label, cmd in MENU_ITEMS.items():
        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
                "WFWorkflowActionParameters": {
                    "GroupingIdentifier": menu_uuid,
                    "WFControlFlowMode": 1,
                    "WFMenuItemTitle": label,
                },
            }
        )

        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
                "WFWorkflowActionParameters": {
                    "UUID": url_uuids[label],
                    "WFURL": api_url,
                    "WFHTTPMethod": "POST",
                    "WFHTTPBodyType": "JSON",
                    "WFHTTPHeaders": make_dictionary_value(
                        [make_dict_field("x-api-key", api_key)]
                    ),
                    "WFJSONValues": make_dictionary_value(
                        [
                            make_dict_field("command", cmd),
                            make_dict_field("pin", pin),
                        ]
                    ),
                },
            }
        )

        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
                "WFWorkflowActionParameters": {
                    "UUID": dict_uuids[label],
                    "WFInput": make_output_ref(url_uuids[label], "Contents of URL"),
                    "WFDictionaryKey": "message",
                },
            }
        )

        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
                "WFWorkflowActionParameters": {
                    "WFNotificationActionTitle": f"GV70 {label}",
                    "WFNotificationActionBody": make_output_ref(
                        dict_uuids[label], "Dictionary Value"
                    ),
                },
            }
        )

    # Menu end
    actions.append(
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": menu_uuid,
                "WFControlFlowMode": 2,
            },
        }
    )

    return {
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowClientVersion": "2700.0.4",
        "WFWorkflowIcon": {
            "WFWorkflowIconGlyphNumber": 59511,  # Car icon
            "WFWorkflowIconStartColor": 463140863,  # Dark blue
        },
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowActions": actions,
        "WFWorkflowTypes": [],
    }


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "shortcuts")
    os.makedirs(out_dir, exist_ok=True)

    # Clean old shortcuts
    for f in os.listdir(out_dir):
        if f.endswith(".shortcut"):
            os.remove(os.path.join(out_dir, f))

    print("Generating GV70 Control shortcut...")
    plist = build_menu_shortcut(API_URL_PLACEHOLDER, API_KEY, PIN)
    unsigned = os.path.join(out_dir, "GV70-Control-unsigned.shortcut")
    signed = os.path.join(out_dir, "GV70-Control.shortcut")
    with open(unsigned, "wb") as f:
        plistlib.dump(plist, f, fmt=plistlib.FMT_BINARY)

    result = subprocess.run(
        ["shortcuts", "sign", "--mode", "anyone", "--input", unsigned, "--output", signed],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        os.remove(unsigned)
        print(f"  Signed: {signed}")
    else:
        print(f"  Signing failed: {result.stderr}")
        print(f"  Unsigned file saved: {unsigned}")

    print(f"\nShortcut saved to: {out_dir}")
    print("AirDrop or text it to your iPhone!")


if __name__ == "__main__":
    main()
