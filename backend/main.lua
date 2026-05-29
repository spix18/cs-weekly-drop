local http = require("http")
local cjson = require("cjson")

local function get_plugin_dir()
    local source = debug.getinfo(1).source
    if source:sub(1, 1) == "@" then
        source = source:sub(2)
    end
    local dir = source:match("(.+)[/\\][^/\\]+[/\\][^/\\]+$")
    return dir or ""
end

function install_update(params)
    local url = params.url
    local plugin_dir = get_plugin_dir()
    local plugins_dir = plugin_dir:match("(.+)[/\\][^/\\]+$") or ""
    local temp_zip = plugin_dir .. "/update.zip"

    local ok, response = pcall(http.get, url)
    if not ok then
        return cjson.encode({ success = false, error = "download failed: " .. tostring(response) })
    end

    local body
    if type(response) == "table" then
        if response.status and response.status ~= 200 then
            return cjson.encode({ success = false, error = "http " .. tostring(response.status) })
        end
        body = response.body
    else
        body = tostring(response)
    end

    if not body or #body == 0 then
        return cjson.encode({ success = false, error = "empty response" })
    end

    local file = io.open(temp_zip, "wb")
    if not file then
        return cjson.encode({ success = false, error = "cannot write temp file" })
    end
    file:write(body)
    file:close()

    local ps_cmd = string.format(
        'powershell -NoProfile -Command "Expand-Archive -Path ''%s'' -DestinationPath ''%s'' -Force"',
        temp_zip:gsub("'", "''"),
        (plugins_dir or ""):gsub("'", "''")
    )

    local exit_code = os.execute(ps_cmd)
    if exit_code ~= 0 then
        pcall(function() os.remove(temp_zip) end)
        return cjson.encode({ success = false, error = "extract failed (code " .. tostring(exit_code) .. ")" })
    end

    pcall(function() os.remove(temp_zip) end)
    return cjson.encode({ success = true })
end
