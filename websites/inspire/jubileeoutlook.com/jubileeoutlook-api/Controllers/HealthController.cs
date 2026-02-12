using JubileeOutlook.Api.DTOs;
using JubileeOutlook.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace JubileeOutlook.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly IHealthService _healthService;

    public HealthController(IHealthService healthService)
    {
        _healthService = healthService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<HealthStatus>>> GetHealth()
    {
        var status = await _healthService.GetHealthStatusAsync();
        return Ok(ApiResponse<HealthStatus>.Ok(status));
    }
}
