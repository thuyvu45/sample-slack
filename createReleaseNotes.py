import boto3
import base64
import jira.client
import json
import sys
import markdown
import traceback

from botocore.exceptions import ClientError
from jira.client import JIRA
from datetime import date
from mdutils.mdutils import MdUtils

def get_secret():
    secret_name = "/develop/jira/api"
    region_name = "us-east-1"

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(service_name='secretsmanager', region_name=region_name)

    try:
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
    except ClientError as e:
        if e.response['Error']['Code'] == 'DecryptionFailureException':
            # Secrets Manager can't decrypt the protected secret text using the provided KMS key.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'InternalServiceErrorException':
            # An error occurred on the server side.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'InvalidParameterException':
            # You provided an invalid value for a parameter.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'InvalidRequestException':
            # You provided a parameter value that is not valid for the current state of the resource.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'ResourceNotFoundException':
            # We can't find the resource that you asked for.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
    else:
        # Decrypts secret using the associated KMS CMK.
        # Depending on whether the secret is a string or binary, one of these fields will be populated.
        if 'SecretString' in get_secret_value_response:
            secret = get_secret_value_response['SecretString']
            #print(secret)
            return secret
        else:
            decoded_binary_secret = base64.b64decode(get_secret_value_response['SecretBinary'])
            #print(decoded_binary_secret)
            return decoded_binary_secret
        
def getLatestReleaseVersionId():
    ssm = boto3.client('ssm')
    parameter = ssm.get_parameter(Name='/develop/jira/lastestReleaseID', WithDecryption=True)
    return (parameter['Parameter']['Value'])

def putLatestReleaseVersionId(lastVersion):
    ssm = boto3.client('ssm')
    ssm.put_parameter(Name='/develop/jira/lastestReleaseID', Value=lastVersion, Overwrite=True, Type='String')

def createMarkdownFile(pz_releases, issues, markdownFileName):
    # title
    md_title="PPG Services Release Summary ({}, {})".format(dayOfWeek, date_str)
    # Header
    mdFile = MdUtils(file_name=markdownFileName,title=md_title)

    # for each release line, add issues
    releases = sorted(pz_releases.keys(), reverse=True)
    for r in releases:
        release = pz_releases.get(r)
        mdFile.new_line()
        mdFile.new_line()
        mdFile.new_header(level=1, title='Release {} ({}):'.format(release[1], release[2]))
        for issue in issues:
            if issue.fields.customfield_10414[0] == release[1]:
                text='{}: {}.\n'.format(issue.key, issue.fields.summary)
                mdFile.new_line(text)
    mdFile.new_line()

    # Write to markdown document
    mdFile.create_md_file()

    # create html file
    with open('{}.md'.format(markdownFileName), "r", encoding="utf-8") as input_file:
        text = input_file.read()
        html = markdown.markdown(text)
    with open('{}.html'.format(markdownFileName), "w", encoding="utf-8", errors="xmlcharrefreplace") as output_file:
        output_file.write(html)

def getIssuesForProject(jira, project_name):
    global lastReleaseDate
    global newLatestVersionID
    str=""
    hasRelease = False
    issues = []
    # connect to the project
    pzp = jira.project(project_name)
    # get all the release version since last release
    versions = jira.project_versions(pzp)
    # process the versions
    for version in versions:
        versionName = version.name.split('/')
        if len(versionName) == 2:
            versionDate = versionName[1]
            # only select version date greater than last time we run the tool
            if ((version.id > latest_release_id) and (versionDate > latest_release_date)):
                str+=version.id + ","
                newLatestVersionID=version.id
                lastReleaseDate = versionDate
                hasRelease = True

    if hasRelease == True:
        # construct the JQL
        str = '(' + str[0:len(str)-1] + ')'
        jql_query="project = \"{}\" AND fixVersion in {}".format(project_name, str)
        # get all the releasedable issues since last release
        issues = jira.search_issues(jql_query)
    return issues

try:
    # get project names from user input, if not defined, default to PZP, EI and DVO
    project_names = []
    i = 1
    while i < len(sys.argv):
        project_names.append(sys.argv[i])
        i += 1

    if len(project_names) == 0:
        project_names = [ 'PZP', 'EI', 'DVO' ]

    newLatestVersionID = ""
    lastReleaseDate = ""

    # Date
    today = date.today()
    dayOfWeek = today.strftime('%A')
    date_str = today.strftime("%m-%d-%y")
    markdownFileName='releaseNotes/PaintzenRelease-{}'.format(date_str)

    # get authentication values from AWS Secret
    jira_secret=json.loads(get_secret())
    email=jira_secret['email']
    key=jira_secret['api_key']

    # get latestReleaseVersionID from SSM
    latest_release=getLatestReleaseVersionId()
    latest_release_id=latest_release.split('/')[0]
    latest_release_date=latest_release.split('/')[1]

    # connect to JIRA
    options = {'server': 'https://paintzen.atlassian.net'}
    jira = JIRA(options, basic_auth=(email, key))

    # get all the releasedable issues since last release
    rawIssues = []
    issues = []
    for project_name in project_names:
        rawIssues = rawIssues + getIssuesForProject(jira, project_name)
    
    # create list of PZ releases
    pz_releases = {}
    for issue in rawIssues:
        # make sure to do this when there is "Paintzen Release Version" on the project
        if issue.fields.customfield_10414 is not None:
            release_name = issue.fields.customfield_10414[0]
            fix_versions = issue.fields.fixVersions
            release_date = fix_versions[-1].name.split('/')[1]
            release_id = issue.fields.fixVersions[0].id
            pz_releases[release_name] = (release_id, release_name, release_date)
            issues.append(issue)
    
    if len(issues) > 0:
        # create Markdown document
        createMarkdownFile(pz_releases, issues, markdownFileName)
        # Update latest version only when there is release
        putLatestReleaseVersionId("{}/{}".format(newLatestVersionID, lastReleaseDate))
        print(markdownFileName)
    else:
        print("There is no new release.")
except Exception as e:
    print(e)
    traceback.print_exc(file=sys.stdout)
