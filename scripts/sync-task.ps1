param (
    [Parameter(Mandatory=$true)]
    [int]$IssueNumber,

    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "done")]
    [string]$Action
)

# Project Configuration
$projectId = "PVT_kwHOCma9ys4Bb7Od"
$statusFieldId = "PVTSSF_lAHOCma9ys4Bb7OdzhWn5cw"
$inProgressOptionId = "47fc9ee4"
$doneOptionId = "98236657"

Write-Host "Syncing Issue #$IssueNumber to status: $Action..." -ForegroundColor Cyan

# Verify gh CLI is logged in
$ghAuth = gh auth status 2>&1
if ($LastExitCode -ne 0) {
    Write-Error "GitHub CLI (gh) is not authenticated or not installed. Please run 'gh auth login' first."
    exit 1
}

# Fetch project items
Write-Host "Fetching project items..."
$jsonText = gh project item-list 3 --owner cjb1077 --format json
if ($LastExitCode -ne 0 -or [string]::IsNullOrEmpty($jsonText)) {
    Write-Error "Failed to fetch project items. Verify your permissions and project configuration."
    exit 1
}

$data = ConvertFrom-Json $jsonText
$item = $data.items | Where-Object { $_.content.number -eq $IssueNumber }

if (-not $item) {
    Write-Error "Could not find Issue #$IssueNumber in the GitHub Project board."
    exit 1
}

# Get item ID (handle array if multiple matches found)
if ($item -is [array]) {
    $itemId = $item[0].id
} else {
    $itemId = $item.id
}

if ($Action -eq "start") {
    # 1. Assign the issue to current user
    Write-Host "Assigning Issue #$IssueNumber to self..."
    gh issue edit $IssueNumber --add-assignee "@me" | Out-Null
    
    # 2. Move project status to In Progress
    Write-Host "Moving project item to In Progress..."
    gh project item-edit --project-id $projectId --id $itemId --field-id $statusFieldId --single-select-option-id $inProgressOptionId | Out-Null
    
    Write-Host "Successfully marked Issue #$IssueNumber as In Progress!" -ForegroundColor Green
}
elseif ($Action -eq "done") {
    # 1. Close the GitHub issue
    Write-Host "Closing Issue #$IssueNumber..."
    gh issue close $IssueNumber | Out-Null
    
    # 2. Move project status to Done
    Write-Host "Moving project item to Done..."
    gh project item-edit --project-id $projectId --id $itemId --field-id $statusFieldId --single-select-option-id $doneOptionId | Out-Null
    
    Write-Host "Successfully marked Issue #$IssueNumber as Done!" -ForegroundColor Green
}
